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
import { ConsensusParameters } from '../../../../models/consensus.model';
import { Node } from '../../../../models/node';
import { AddressService } from '../../../../services/address.service';
import { BlockchainComponent } from '../../blockchain/blockchain.component';
import { EventLogsComponent } from '../../event-logs/event-logs.component';
import { ConsensusDialogComponent } from './consensus-dialog/consensus-dialog.component';
import { MiningBlockComponent } from './mining-block/mining-block.component';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miner',
  standalone: true,
  imports: [
    CommonModule,
    MiningBlockComponent,
    BlockchainComponent,
    EventLogsComponent,
    ConsensusDialogComponent,
  ],
  templateUrl: './miner.component.html',
  styleUrls: ['./miner.component.scss'],
})
export class MinerComponent {
  slideXValue = 'translateX(100%)';
  isBlockchainVisible = true;

  @Input() miner!: Node;
  @Output() miningChanged = new EventEmitter<Node>();
  @Output() minerRemoved = new EventEmitter<Node>();
  @Output() collapsedChange = new EventEmitter<Node>();
  @Output() maximizedChange = new EventEmitter<Node>();
  @Output() logsMaximizedChange = new EventEmitter<Node>();
  @Output() hashRateChange = new EventEmitter<number | null>();
  @Output() blockBroadcasted = new EventEmitter<{
    minerId: number;
    block: Block;
  }>();
  @Output() transactionBroadcasted = new EventEmitter<{
    minerId: number;
    transaction: Transaction;
  }>();

  isCollapsedHashRateSelectorOpen = false;

  hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '10 H/s', value: 10 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];

  showConsensusDialog = false;

  constructor(
    private addressService: AddressService,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    // Reinicia a mineração caso estivesse minerando
    if (this.miner.isMining) {
      // Para garantir que não haja intervalos residuais
      this.stopMining();
      // Reinicia a mineração
      this.startMining();
    }
  }

  // Método para iniciar mineração
  startMining() {
    if (this.miner.isMining) return;

    // Cria um novo bloco se não houver um atual
    if (!this.miner.currentBlock) {
      this.miner.currentBlock = this.miner.initBlockTemplate();
    }

    this.miner.isMining = true;
    this.miner.miningLastTickTime = Date.now();

    this.miningChanged.emit(this.miner);
  }

  stopMining() {
    if (!this.miner.isMining) return;

    this.miner.isMining = false;

    // Ao pausar, atualiza o tempo decorrido até agora no bloco
    this.miner.miningLastTickTime = null;

    this.miningChanged.emit(this.miner);
  }

  removeMiner() {
    this.stopMining();
    this.minerRemoved.emit(this.miner);
  }

  setHashRate(rate: number | null) {
    this.miner.hashRate = rate;
    if (this.miner.isMining) {
      this.stopMining();
      this.startMining();
    }

    this.hashRateChange.emit(rate);
  }

  // Processa um tick de mineração
  processMiningTick(now: number, batchSize: number) {
    if (
      !this.miner.isMining ||
      !this.miner.currentBlock ||
      this.miner.isAddingBlock
    )
      return;

    const block = this.miner.currentBlock;
    const hashRate = this.miner.hashRate;

    // Atualiza o tempo decorrido
    if (!this.miner.miningLastTickTime) {
      this.miner.miningLastTickTime = now;
    }

    const tickTime = now - this.miner.miningLastTickTime;
    block.miningElapsed += tickTime;
    this.miner.miningLastTickTime = now;

    if (hashRate === null) {
      // Modo máximo - processa o batch size adaptativo
      for (let i = 0; i < batchSize + 1; i++) {
        block.nonce++;
        block.hash = block.calculateHash();
        this.miner.incrementHashCount();

        if (block.isValid()) {
          this.handleValidBlock(block);
          break;
        }
      }
    } else {
      if (this.miner.miningLastHashTime === null) {
        this.miner.miningLastHashTime = 0;
      }

      this.miner.miningLastHashTime += tickTime;

      // Modo com hash rate controlado
      const timeNeededForOneHash = 1000 / hashRate; // tempo em ms para 1 hash
      const hashesToProcess =
        this.miner.miningLastHashTime >= timeNeededForOneHash
          ? Math.floor(this.miner.miningLastHashTime / timeNeededForOneHash)
          : 0;

      // Se houver hashes para processar, atualiza o tempo restante
      if (hashesToProcess > 0) {
        this.miner.miningLastHashTime -= timeNeededForOneHash * hashesToProcess;
      }

      for (let i = 0; i < hashesToProcess; i++) {
        block.nonce++;
        block.hash = block.calculateHash();
        this.miner.incrementHashCount();

        if (block.isValid()) {
          this.handleValidBlock(block);
          break;
        }
      }
    }
  }

  private handleValidBlock(block: Block) {
    block.minerId = this.miner.id;
    this.miner.isAddingBlock = true;

    setTimeout(() => {
      this.miner.addBlock(block);
      this.miner.isAddingBlock = false;

      this.miner.updateLastMainBlocks();
      this.miner.updateActiveForkHeights();

      // Emite evento para propagar o bloco
      this.blockBroadcasted.emit({ minerId: this.miner.id!, block });
    }, 600);

    // Cria um novo bloco para continuar minerando
    this.miner.initBlockTemplate(block);
    // Reinicia o cronômetro para o novo bloco
    const newBlock = this.miner.currentBlock;
    if (newBlock) {
      newBlock.miningElapsed = 0;
    }
  }

  createTransaction() {
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
      signature: this.miner.name, // Usando o nome do miner como assinatura temporária
    };

    // TODO: Adicionar a transação à mempool do miner

    // TODO: Iniciar a propagação da transação
    // this.propagateTransaction(tx, miner);
    this.transactionBroadcasted.emit({
      minerId: this.miner.id!,
      transaction: tx,
    });
  }

  toggleBlockchainVisibility() {
    this.isBlockchainVisible = !this.isBlockchainVisible;
  }

  setOrToggleCollapsed(collapsed?: boolean) {
    this.miner.isCollapsed = collapsed ?? !this.miner.isCollapsed;
    this.collapsedChange.emit(this.miner);

    return this.miner.isCollapsed;
  }

  getHashRateIndex(): number {
    return this.hashRateOptions.findIndex(
      (option) => option.value === this.miner.hashRate
    );
  }

  setOrToggleMaximized(isMaximized?: boolean) {
    this.miner.isMaximized = isMaximized ?? !this.miner.isMaximized;
    this.maximizedChange.emit(this.miner);
  }

  showLogs() {
    this.miner.isLogsMaximized = true;
    this.logsMaximizedChange.emit(this.miner);
  }

  closeLogs() {
    this.miner.isLogsMaximized = false;
    this.logsMaximizedChange.emit(this.miner);
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

  editConsensusParams() {
    this.showConsensusDialog = true;
  }

  onConsensusDialogClose() {
    this.showConsensusDialog = false;
  }

  onConsensusDialogSave(newParams: ConsensusParameters) {
    this.miner.consensus = { ...newParams };
    this.showConsensusDialog = false;
  }
}
