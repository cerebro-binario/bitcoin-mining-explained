import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { Block, Transaction } from '../../../../models/block.model';
import { Node } from '../../../../models/node';
import { AddressService } from '../../../../services/address.service';
import { BlockchainComponent } from '../../blockchain/blockchain.component';
import { MiningBlockComponent } from './mining-block/mining-block.component';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miner',
  standalone: true,
  imports: [CommonModule, MiningBlockComponent, BlockchainComponent],
  templateUrl: './miner.component.html',
  //   styleUrls: ['./miner.component.scss'],
})
export class MinerComponent {
  slideXValue = 'translateX(100%)';
  isBlockchainVisible = true;
  isCollapsed = false;
  showAllLogs = false;
  realHashRate = 0;
  private lastHashRateUpdate = 0;
  private hashCount = 0;
  isBlockchainFullscreen = false;

  @Input() miner!: Node;
  @Input() hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '100 H/s', value: 100 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];
  @Input() collapseOnInit = false;
  @Output() minerRemoved = new EventEmitter<{ minerId: number }>();
  @Output() blockBroadcasted = new EventEmitter<{
    minerId: number;
    block: Block;
  }>();
  @Output() transactionBroadcasted = new EventEmitter<{
    minerId: number;
    transaction: Transaction;
  }>();
  @Output() minerCollapsed = new EventEmitter<boolean>();

  isCollapsedHashRateSelectorOpen = false;

  constructor(
    private addressService: AddressService,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    this.isCollapsed = this.collapseOnInit;

    // Reinicia a mineração caso estivesse minerando
    if (this.miner.isMining) {
      // Para garantir que não haja intervalos residuais
      this.stopMining(this.miner);
      // Reinicia a mineração
      this.startMining(this.miner);
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
    if (!miner.isMining || !miner.currentBlock || miner.isAddingBlock) return;

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

  private handleValidBlock(miner: Node, block: Block) {
    block.minerId = miner.id;
    miner.isAddingBlock = true;

    setTimeout(() => {
      miner.addBlock(block);
      miner.isAddingBlock = false;
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

  toggleCollapsed() {
    this.isCollapsed = !this.isCollapsed;
    this.minerCollapsed.emit(this.isCollapsed);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (
      this.isCollapsedHashRateSelectorOpen &&
      this.elRef &&
      !this.elRef.nativeElement.contains(event.target)
    ) {
      this.isCollapsedHashRateSelectorOpen = false;
    }
  }
}
