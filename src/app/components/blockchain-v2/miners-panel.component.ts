import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { TooltipModule } from 'primeng/tooltip';
import { BitcoinNode, BlockNode } from '../../models/bitcoin-node.model';
import { Transaction, Block } from '../../models/block.model';
import { AddressService } from '../../services/address.service';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { BlockchainService } from '../../services/blockchain.service';
import { MiningBlockComponent } from './mining-block/mining-block.component';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [CommonModule, MiningBlockComponent, TooltipModule],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
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
export class MinersPanelComponent implements OnInit, OnDestroy, AfterViewInit {
  hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '100 H/s', value: 100 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];

  private readonly SAVE_INTERVAL = 5000; // Salva a cada 5 segundos
  private saveInterval?: any;

  // Propriedades para o cálculo de gaps
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
  private hasCalculatedGaps = false;
  isMoving = new Set<number>();
  slideXValue = 'translateX(100%)';
  isBlockchainVisible = new Map<number, boolean>(); // nodeId -> isVisible

  constructor(
    public network: BitcoinNetworkService,
    private blockchain: BlockchainService,
    private addressService: AddressService
  ) {}

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  ngOnInit() {
    // Reinicia a mineração para todos os mineradores que estavam minerando
    this.miners.forEach((miner) => {
      if (miner.isMining) {
        // Para garantir que não haja intervalos residuais
        this.stopMining(miner);
        // Reinicia a mineração
        this.startMining(miner);
      }
    });
  }

  addMiner() {
    const node = this.network.addNode(true, undefined, 1000);
    node.name = `Minerador ${node.id}`;
    node.miningAddress = this.addressService.generateRandomAddress();

    // Se for o primeiro miner, cria o bloco genesis imediatamente
    if (this.network.nodes.length === 1) {
      node.currentBlock = this.blockchain.createNewBlock(node);
      this.network.save();
      this.network.markInitialSyncComplete(node.id!);
      return;
    }

    // Marca o nó como sincronizando
    this.network.startNodeSync(node.id!);

    // Simula o download da blockchain através dos vizinhos
    // Ordena os vizinhos por latência (menor primeiro)
    const sortedNeighbors = [...node.neighbors].sort(
      (a, b) => a.latency - b.latency
    );

    // Função para verificar se algum vizinho completou o download
    const checkNeighborsForDownload = () => {
      // Tenta obter a blockchain do vizinho com menor latência que já completou o sync
      for (const neighbor of sortedNeighbors) {
        const neighborNode = this.network.nodes.find(
          (n) => n.id === neighbor.nodeId
        );

        // Se o vizinho não existe ou ainda não completou seu sync inicial, pula
        if (
          !neighborNode ||
          !this.network.isInitialSyncComplete(neighborNode.id!)
        ) {
          continue;
        }

        // Se o vizinho tem blocos, usa a blockchain dele
        if (neighborNode.genesis) {
          setTimeout(() => {
            // Copia a árvore de blocos do vizinho
            node.genesis = BlockNode.deserializeBlockNode(
              BlockNode.serializeBlockNode(neighborNode.genesis as BlockNode)
            );
            node.heights = neighborNode.heights.slice();
            // Usa o último bloco da main chain como referência para criar um novo bloco
            node.currentBlock = this.blockchain.createNewBlock(
              node,
              neighborNode.getLatestBlock()
            );
            this.network.save();
            this.network.stopNodeSync(node.id!);
            this.network.markInitialSyncComplete(node.id!);
          }, neighbor.latency);
          return true; // Download iniciado
        }
      }
      return false; // Nenhum vizinho pronto para download
    };

    // Tenta iniciar o download imediatamente
    if (checkNeighborsForDownload()) {
      return;
    }

    // Se não encontrou nenhum vizinho pronto, aguarda e tenta novamente
    const checkInterval = setInterval(() => {
      if (checkNeighborsForDownload()) {
        clearInterval(checkInterval);
      }
    }, 1000); // Verifica a cada segundo

    // Se após 30 segundos ainda não encontrou nenhum vizinho pronto, cria um bloco genesis
    setTimeout(() => {
      clearInterval(checkInterval);
      // Cria um bloco genesis
      node.currentBlock = this.blockchain.createNewBlock(node);
      this.network.save();
      // Remove o nó da lista de sincronização
      this.network.stopNodeSync(node.id!);
      // Marca a sincronização inicial como completa
      this.network.markInitialSyncComplete(node.id!);
    }, 30000);
  }

  createTransaction(miner: BitcoinNode) {
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

    // Adiciona a transação à mempool do miner
    this.blockchain.addTransactionToMempool(tx);

    // Inicia a propagação da transação
    this.propagateTransaction(tx, miner);
  }

  private propagateTransaction(tx: Transaction, sourceNode: BitcoinNode) {
    // Ordena os vizinhos por latência
    const sortedNeighbors = [...sourceNode.neighbors].sort(
      (a, b) => a.latency - b.latency
    );

    // Propaga para cada vizinho com um delay baseado na latência
    sortedNeighbors.forEach((neighbor) => {
      const targetNode = this.network.nodes.find(
        (n) => n.id === neighbor.nodeId
      );
      if (!targetNode) return;

      // Simula o delay de propagação baseado na latência
      setTimeout(() => {
        // Adiciona a transação à mempool do nó vizinho
        this.blockchain.addTransactionToMempool(tx);

        // Se o nó vizinho não é a fonte, continua propagando
        if (targetNode.id !== sourceNode.id) {
          this.propagateTransaction(tx, targetNode);
        }
      }, neighbor.latency);
    });
  }

  removeMiner(index: number) {
    const miner = this.miners[index];
    if (miner) {
      this.stopMining(miner);
      this.network.removeNode(miner.id!);
    }
  }

  setHashRate(miner: BitcoinNode, rate: number | null) {
    miner.hashRate = rate;
    if (miner.isMining) {
      this.stopMining(miner);
      this.startMining(miner);
    }
    this.network.save();
  }

  private saveMiningState() {
    this.network.save();
  }

  // Método para adicionar um bloco
  private async addBlock(miner: BitcoinNode, block: Block) {
    this.isMoving.add(miner.id!);
    await this.wait(600);
    miner.addBlock(block);
    this.isMoving.delete(miner.id!);
  }

  // Método para iniciar mineração
  async startMining(miner: BitcoinNode) {
    if (miner.isMining) return;

    // Cria um novo bloco se não houver um atual
    if (!miner.currentBlock) {
      miner.currentBlock = this.blockchain.createNewBlock(miner);
    }

    miner.isMining = true;
    const hashRate = miner.hashRate;

    // Cronômetro de mineração no bloco
    const block = miner.currentBlock;
    if (block) {
      // Se for um novo bloco, zera o cronômetro
      if (!block.miningStartTime && !block.miningElapsed) {
        block.miningElapsed = 0;
      }
      block.miningStartTime = Date.now();
      if (block.miningTimer) clearInterval(block.miningTimer);
      block.miningTimer = setInterval(() => {
        if (miner.isMining && block.miningStartTime) {
          block.miningElapsed += Date.now() - block.miningStartTime;
          block.miningStartTime = Date.now();
        }
      }, 100);
    }

    // Inicia o intervalo para salvar o estado periodicamente
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.saveInterval = setInterval(() => {
      this.saveMiningState();
    }, this.SAVE_INTERVAL);

    // Variáveis para controle do batch
    let lastBatchTime = Date.now();
    let accumulatedTime = 0;
    let batchStartTime = Date.now();
    let hashesInCurrentBatch = 0;

    miner.miningInterval = setInterval(() => {
      if (!miner.currentBlock || this.isMoving.has(miner.id!)) return;
      const block = miner.currentBlock;

      const now = Date.now();
      const timeSinceLastBatch = now - lastBatchTime;
      accumulatedTime += timeSinceLastBatch;

      if (hashRate === null) {
        // Modo máximo - processa o máximo possível
        const BATCH_SIZE = 1000;
        for (let i = 0; i < BATCH_SIZE; i++) {
          block.nonce++;
          block.hash = block.calculateHash();
          hashesInCurrentBatch++;

          if (this.blockchain.isValidBlock(block)) {
            // Para o cronômetro
            if (block.miningTimer) clearInterval(block.miningTimer);
            block.miningStartTime = null;

            block.minerId = miner.id;
            this.isMoving.add(miner.id!);

            setTimeout(() => {
              miner.addBlock(block);
              this.isMoving.delete(miner.id!);
              // Propaga o bloco para os vizinhos
              this.network.propagateBlock(miner.id!, block);
            }, 600);

            // Cria um novo bloco para continuar minerando
            miner.currentBlock = this.blockchain.createNewBlock(miner, block);
            // Reinicia o cronômetro para o novo bloco
            const newBlock = miner.currentBlock;
            if (newBlock) {
              newBlock.miningElapsed = 0;
              newBlock.miningStartTime = Date.now();
              if (newBlock.miningTimer) clearInterval(newBlock.miningTimer);
              newBlock.miningTimer = setInterval(() => {
                if (miner.isMining && newBlock.miningStartTime) {
                  newBlock.miningElapsed +=
                    Date.now() - newBlock.miningStartTime;
                  newBlock.miningStartTime = Date.now();
                }
              }, 100);
            }

            // Salva o estado imediatamente após minerar um bloco
            this.saveMiningState();
            break;
          }
        }
      } else {
        // Modo com hash rate controlado
        const timeNeededForOneHash = 1000 / hashRate; // tempo em ms para 1 hash
        if (accumulatedTime >= timeNeededForOneHash) {
          const hashesToProcess = Math.floor(
            accumulatedTime / timeNeededForOneHash
          );

          for (let i = 0; i < hashesToProcess; i++) {
            block.nonce++;
            block.hash = block.calculateHash();
            hashesInCurrentBatch++;

            if (this.blockchain.isValidBlock(block)) {
              // Para o cronômetro
              if (block.miningTimer) clearInterval(block.miningTimer);
              block.miningStartTime = null;

              // Adiciona o bloco à blockchain do minerador
              block.minerId = miner.id;

              this.isMoving.add(miner.id!);

              setTimeout(() => {
                miner.addBlock(block);
                this.isMoving.delete(miner.id!);
                // Propaga o bloco para os vizinhos
                this.network.propagateBlock(miner.id!, block);
              }, 600);

              // Cria um novo bloco para continuar minerando
              miner.currentBlock = this.blockchain.createNewBlock(miner, block);
              // Reinicia o cronômetro para o novo bloco
              const newBlock = miner.currentBlock;
              if (newBlock) {
                newBlock.miningElapsed = 0;
                newBlock.miningStartTime = Date.now();
                if (newBlock.miningTimer) clearInterval(newBlock.miningTimer);
                newBlock.miningTimer = setInterval(() => {
                  if (miner.isMining && newBlock.miningStartTime) {
                    newBlock.miningElapsed +=
                      Date.now() - newBlock.miningStartTime;
                    newBlock.miningStartTime = Date.now();
                  }
                }, 100);
              }

              // Salva o estado imediatamente após minerar um bloco
              this.saveMiningState();
              break;
            }
          }

          accumulatedTime = accumulatedTime % timeNeededForOneHash;
        }
      }

      // Atualiza o tempo do último batch
      lastBatchTime = now;

      // Atualiza o hash rate real a cada segundo
      if (now - batchStartTime >= 1000) {
        miner.currentHashRate = hashesInCurrentBatch;
        batchStartTime = now;
        hashesInCurrentBatch = 0;
      }
    }, 100); // Intervalo mínimo de 1ms

    this.saveMiningState();
  }

  stopMining(miner: BitcoinNode) {
    if (!miner.isMining) return;

    miner.isMining = false;
    if (miner.miningInterval) {
      clearInterval(miner.miningInterval);
      miner.miningInterval = undefined;
    }
    // Ao pausar, atualiza o tempo decorrido até agora no bloco
    const block = miner.currentBlock;
    if (block && block.miningStartTime) {
      if (block.miningTimer) clearInterval(block.miningTimer);
      block.miningElapsed += Date.now() - block.miningStartTime;
      block.miningStartTime = null;
    }

    // Limpa o intervalo de salvamento
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }

    this.saveMiningState();
  }

  isSyncing(node: BitcoinNode): boolean {
    return this.network.isNodeSyncing(node.id!);
  }

  ngOnDestroy() {
    // Limpa os intervalos quando o componente é destruído
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  }

  // Verifica se a altura está resolvida (todos os blocos da altura estão na main chain)
  isHeightResolved(miner: BitcoinNode, height: number): boolean {
    const blocks = miner.heights[height];
    const activeBlocks = blocks.filter((b) => b.isActive).length; // Conta apenas blocos ativos
    return activeBlocks === 1;
  }

  // Calcula o valor dinâmico para o topo da conexão
  getDynamicTopValue(total: number, index: number): number {
    return (100 / (total + 1)) * (index + 1);
  }

  // Calcula o caminho curvo para a conexão
  getCurvedPath(miner: BitcoinNode, node: BlockNode, height: number): string {
    if (!this.hasCalculatedGaps) {
      this.calculateGaps();
      this.hasCalculatedGaps = true;
    }

    const parent = node.parent;
    if (!parent) return '';

    const hTotal = parent.children.length;
    const h = parent.children.findIndex(
      (c) => c.block.hash === node.block.hash
    );
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
    const endY =
      (this.getDynamicTopValue(hTotal, h) / 100) * this.connectorViewbox.h +
      (this.connectorViewbox.h + this.gap.y.value) *
        (prevPosition - currPosition);
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

    requestAnimationFrame(() => {
      this.slideXValue = `translateX(calc(100% + ${this.gap.x.value}px))`;
    });

    this.connectorViewbox = { w: blockWidth, h: blockHeight };
  }

  // Método chamado após a view ser inicializada
  ngAfterViewInit() {
    // Verifica se existe algum bloco minerado
    const hasBlocks = this.miners.some((miner) => miner.heights.length > 0);
    if (hasBlocks) {
      requestAnimationFrame(() => {
        this.calculateGaps();
      });
    }
  }

  // Método para trackBy no *ngFor
  trackByBlockHash(index: number, node: BlockNode): string {
    return node.block.hash;
  }

  // Função auxiliar para esperar um tempo
  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  toggleBlockchainVisibility(miner: BitcoinNode) {
    const current = this.isBlockchainVisible.get(miner.id!) ?? true;
    this.isBlockchainVisible.set(miner.id!, !current);
  }

  isBlockchainVisibleFor(miner: BitcoinNode): boolean {
    return this.isBlockchainVisible.get(miner.id!) ?? true;
  }
}
