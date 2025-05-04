import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Block, BlockNode, Transaction } from '../../../../models/block.model';
import { Node } from '../../../../models/node';
import { AddressService } from '../../../../services/address.service';
import { MiningBlockComponent } from './mining-block/mining-block.component';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miner',
  standalone: true,
  imports: [CommonModule, MiningBlockComponent],
  templateUrl: './miner.component.html',
  //   styleUrls: ['./miner.component.scss'],
  animations: [
    trigger('blockAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.5s ease-out', style({ opacity: 1 })),
      ]),
    ]),
    trigger('slideRightAnimation', [
      state('default', style({ transform: 'translateX(0)' })),
      state('moved', style({ transform: '{{slideXValue}}' }), {
        params: { slideXValue: 'translateX(100%)' },
      }),
      transition('default => moved', [animate('0.5s ease-out')]),
      transition('moved => default', [animate('0s ease-out')]),
    ]),
  ],
})
export class MinerComponent {
  isMoving = false;
  slideXValue = 'translateX(100%)';
  isBlockchainVisible = true;
  isMinerDetailsVisible = true;
  showAllLogs = false;
  realHashRate = 0;
  private lastHashRateUpdate = 0;
  private hashCount = 0;

  // Propriedades para o cálculo de gaps
  private hasCalculatedGaps = false;
  connectorViewbox = { w: 100, h: 100 };
  gap = {
    x: {
      value: 0,
      percentage: 0,
    },
    y: {
      value: 0,
      percentage: 0,
    },
  };

  @Input() miner!: Node;
  @Input() hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '100 H/s', value: 100 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];
  @Output() minerRemoved = new EventEmitter<{ minerId: number }>();
  @Output() blockBroadcasted = new EventEmitter<{
    minerId: number;
    block: Block;
  }>();
  @Output() transactionBroadcasted = new EventEmitter<{
    minerId: number;
    transaction: Transaction;
  }>();

  constructor(private addressService: AddressService) {}

  ngOnInit() {
    // Reinicia a mineração caso estivesse minerando
    if (this.miner.isMining) {
      // Para garantir que não haja intervalos residuais
      this.stopMining(this.miner);
      // Reinicia a mineração
      this.startMining(this.miner);
    }
  }

  // Método chamado após a view ser inicializada
  ngAfterViewInit() {
    // Verifica se existe algum bloco minerado
    const hasBlocks = this.miner.heights.length > 0;
    if (hasBlocks) {
      requestAnimationFrame(() => {
        this.calculateGaps();
      });
    }
  }

  removeMiner(miner: Node) {
    this.stopMining(miner);
    this.minerRemoved.emit({ minerId: miner.id! });
  }

  setHashRate(rate: number | null) {
    this.miner.hashRate = rate;
    if (this.miner.isMining) {
      this.stopMining(this.miner);
      this.startMining(this.miner);
    }
  }

  stopMining(miner: Node) {
    if (!miner.isMining) return;

    miner.isMining = false;

    // Ao pausar, atualiza o tempo decorrido até agora no bloco
    miner.miningLastTickTime = null;
  }

  // Método para iniciar mineração
  startMining(miner: Node) {
    if (miner.isMining) return;

    // Cria um novo bloco se não houver um atual
    if (!miner.currentBlock) {
      miner.currentBlock = miner.initBlockTemplate();
    }

    miner.isMining = true;
    miner.miningLastTickTime = Date.now();
  }

  // Processa um tick de mineração
  processMiningTick(miner: Node, now: number, batchSize: number) {
    if (!miner.isMining || !miner.currentBlock || this.isMoving) return;

    const block = miner.currentBlock;
    const hashRate = miner.hashRate;

    // Atualiza o tempo decorrido
    if (!miner.miningLastTickTime) {
      miner.miningLastTickTime = now;
    }

    const tickTime = now - miner.miningLastTickTime;
    block.miningElapsed += tickTime;
    miner.miningLastTickTime = now;

    if (hashRate === null) {
      // Modo máximo - processa o batch size adaptativo
      for (let i = 0; i < batchSize + 1; i++) {
        block.nonce++;
        block.hash = block.calculateHash();
        miner.incrementHashCount();

        if (block.isValid()) {
          this.handleValidBlock(miner, block);
          break;
        }
      }
    } else {
      if (miner.miningLastHashTime === null) {
        miner.miningLastHashTime = 0;
      }

      miner.miningLastHashTime += tickTime;

      // Modo com hash rate controlado
      const timeNeededForOneHash = 1000 / hashRate; // tempo em ms para 1 hash
      const hashesToProcess =
        miner.miningLastHashTime >= timeNeededForOneHash
          ? Math.floor(miner.miningLastHashTime / timeNeededForOneHash)
          : 0;

      // Se houver hashes para processar, atualiza o tempo restante
      if (hashesToProcess > 0) {
        miner.miningLastHashTime -= timeNeededForOneHash * hashesToProcess;
      }

      for (let i = 0; i < hashesToProcess; i++) {
        block.nonce++;
        block.hash = block.calculateHash();
        miner.incrementHashCount();

        if (block.isValid()) {
          this.handleValidBlock(miner, block);
          break;
        }
      }
    }
  }

  private updateRealHashRate(now: number) {
    // Atualiza o hash rate real a cada segundo
    if (now - this.lastHashRateUpdate >= 1000) {
      this.realHashRate = this.hashCount;
      this.hashCount = 0;
      this.lastHashRateUpdate = now;
    }
  }

  private handleValidBlock(miner: Node, block: Block) {
    block.minerId = miner.id;
    this.isMoving = true;

    setTimeout(() => {
      miner.addBlock(block);
      this.isMoving = false;
      // Emite evento para propagar o bloco
      this.blockBroadcasted.emit({ minerId: miner.id!, block });
    }, 600);

    // Cria um novo bloco para continuar minerando
    miner.initBlockTemplate(block);
    // Reinicia o cronômetro para o novo bloco
    const newBlock = miner.currentBlock;
    if (newBlock) {
      newBlock.miningElapsed = 0;
    }
  }

  createTransaction(miner: Node) {
    // Gera um endereço aleatório para o destinatário
    const recipientAddress = this.addressService.generateRandomAddress();

    // Cria uma nova transação
    const tx: Transaction = {
      id: CryptoJS.SHA256(Date.now().toString()).toString(),
      inputs: [],
      outputs: [
        {
          value: 1000000, // 0.01 BTC em satoshis
          scriptPubKey: recipientAddress,
        },
      ],
      signature: miner.name, // Usando o nome do miner como assinatura temporária
    };

    // TODO: Adicionar a transação à mempool do miner

    // TODO: Iniciar a propagação da transação
    // this.propagateTransaction(tx, miner);
    this.transactionBroadcasted.emit({ minerId: miner.id!, transaction: tx });
  }

  toggleBlockchainVisibility() {
    this.isBlockchainVisible = !this.isBlockchainVisible;
  }

  toggleMinerDetailsVisibility() {
    this.isMinerDetailsVisible = !this.isMinerDetailsVisible;
  }

  // Método para calcular os gaps
  calculateGaps() {
    const container = document.querySelector(
      '#miners-panel-container'
    ) as HTMLElement;
    if (!container) return;

    const containerComputedStyle = window.getComputedStyle(container);

    this.gap.x.value =
      parseFloat(containerComputedStyle.getPropertyValue('gap')) || 0;

    // Calcular gap vertical
    const heightContainer = document.querySelector(
      '.height-element-container'
    ) as HTMLElement;

    const heightComputedStyle = window.getComputedStyle(heightContainer);
    this.gap.y.value =
      parseFloat(heightComputedStyle.getPropertyValue('gap')) || 0;

    const heightElement = document.querySelector(
      '.height-element'
    ) as HTMLElement;
    const blockElement = document.querySelector(
      '.block-element'
    ) as HTMLElement;

    const heightWidth = heightElement.getBoundingClientRect().width;
    const blockWidth = blockElement.getBoundingClientRect().width;
    const blockHeight = blockElement.getBoundingClientRect().height;

    this.gap.x.percentage = (this.gap.x.value / heightWidth) * 100;
    this.gap.y.percentage = (this.gap.y.value / blockHeight) * 100;

    this.connectorViewbox = { w: blockWidth, h: blockHeight };

    requestAnimationFrame(() => {
      this.slideXValue = `translateX(calc(${this.connectorViewbox.w}px + ${this.gap.x.value}px))`;
    });
  }

  // Método para obter a cor de fundo do bloco
  getBlockBackgroundColor(node: BlockNode): string {
    if (!node.isActive) return 'bg-zinc-700/50'; // fundo mais escuro para dead forks
    return 'bg-zinc-800'; // fundo padrão para main chain
  }

  // Método para obter a cor da borda do bloco
  getBlockBorderColor(node: BlockNode): string {
    if (!node.isActive) return 'border-zinc-600/50'; // borda mais clara para dead forks
    return 'border-zinc-600'; // borda padrão para main chain
  }

  // Calcula o caminho curvo para a conexão
  getCurvedPath(miner: Node, node: BlockNode, height: number): string {
    if (!this.hasCalculatedGaps) {
      this.calculateGaps();
      this.hasCalculatedGaps = true;
    }

    const parent = node.parent;
    if (!parent) return '';

    let hTotal = parent.children.length;
    let h = parent.children.findIndex((c) => c.block.hash === node.block.hash);

    const prevPosition = miner.heights[height + 1]?.findIndex(
      (b) => b.block.hash === parent.block.hash
    );
    const currPosition = miner.heights[height]?.findIndex(
      (b) => b.block.hash === node.block.hash
    );
    const startX = this.connectorViewbox.w;
    const startY = this.connectorViewbox.h / 2;

    // Calcula a posição final do bloco filho
    const endX = this.connectorViewbox.w + this.gap.x.value;
    let endY =
      (this.getDynamicTopValue(hTotal, h) / 100) * this.connectorViewbox.h +
      (this.connectorViewbox.h + this.gap.y.value) *
        (prevPosition - currPosition);

    // Caso o pai seja o origin block (fake) e tenha um fork logo no genesis
    if (parent.block.height === -1 && hTotal > 1) {
      endY =
        ((50 * hTotal) / 100) * this.connectorViewbox.h +
        (this.connectorViewbox.h + this.gap.y.value) *
          (prevPosition - currPosition) +
        (this.gap.y.value / 2) * (hTotal - 1);
    }
    // Ponto de controle para a curva
    const midX = (startX + endX) / 2; // Ponto no meio do caminho horizontalmente

    // **AUMENTAMOS** a distância dos pontos de controle para criar uma curva mais acentuada
    const controlX1 = startX + (midX - startX) * 1.15; // Puxa mais a curva na 1ª metade
    const controlX2 = endX + (midX - endX) * 1.15; // Puxa mais a curva na 2ª metade

    const controlY1 = startY;
    const controlY2 = endY;

    return `M ${startX},${startY} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${endX},${endY}`;
  }

  // Retorna a cor da conexão
  getConnectionStrokeColor(node: BlockNode, isResolved: boolean): string {
    if (isResolved) return '#4b5563'; // cinza neutro para main chain
    if (!node.isActive) return '#6b7280'; // cinza mais claro para dead forks
    return '#4b5563'; // cinza neutro para conexões em andamento
  }

  // Calcula o valor dinâmico para o topo da conexão
  getDynamicTopValue(total: number, index: number): number {
    return (100 / (total + 1)) * (index + 1);
  }

  // Verifica se a altura está resolvida (todos os blocos da altura estão na main chain)
  isHeightResolved(height: number): boolean {
    const blocks = this.miner.heights[height];
    const activeBlocks = blocks.filter((b) => b.isActive).length; // Conta apenas blocos ativos
    return activeBlocks === 1;
  }

  getHashRateIndex(): number {
    return this.hashRateOptions.findIndex(
      (option) => option.value === this.miner.hashRate
    );
  }

  onHashRateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const index = parseInt(input.value);
    const selectedOption = this.hashRateOptions[index];
    this.setHashRate(selectedOption.value);
  }

  getOriginBlockTransform(childrenLength: number): string {
    const originBlock = document.querySelector(
      `#originBlock-${this.miner.id}`
    ) as HTMLElement;
    const { width, height } = originBlock.getBoundingClientRect();

    const translateX = Math.round((width / 2) * -1);
    const translateY = Math.round(
      (this.connectorViewbox.h * childrenLength) / 2 -
        height / 2 +
        (this.gap.y.value / 2) * childrenLength
    );

    return 'translate(' + translateX + 'px, ' + translateY + 'px)';
  }

  // Retorna os últimos 5 blocos da main chain (excluindo o origin fake block)
  get lastMainBlocks() {
    const blocks = [];
    let current = this.miner.getLatestBlock();
    let count = 0;
    while (current && current.height >= 0 && count < 5) {
      blocks.unshift(current);
      // Encontra o bloco anterior na main chain
      const prevHash = current.previousHash;
      const prevNode = this.miner.heights
        .flat()
        .find((n) => n.block.hash === prevHash);
      current = prevNode?.block;
      count++;
    }
    return blocks;
  }

  // Retorna as alturas dos forks ativos entre os últimos 5 blocos
  get activeForkHeights() {
    const forkHeights: number[] = [];
    for (const nodes of this.miner.heights) {
      const activeBlocks = nodes.filter((n) => n.isActive);
      if (activeBlocks.length > 1) {
        const height = nodes[0].block.height;
        if (height >= 0) forkHeights.push(height);
      }
    }
    return forkHeights;
  }
}
