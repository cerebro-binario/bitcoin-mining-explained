import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Observable } from 'rxjs';
import { Transaction } from '../../../../models/block.model';
import { IConsensusParameters } from '../../../../models/consensus.model';
import { Node } from '../../../../models/node';
import { AddressService } from '../../../../services/address.service';
import { BlockchainComponent } from '../../blockchain/blockchain.component';
import { EventsComponent } from '../../events/events.component';
import { MiniBlockchainComponent } from '../../mini-blockchain/mini-blockchain.component';
import { ConsensusDialogComponent } from './consensus-dialog/consensus-dialog.component';
import { MiningBlockComponent } from './mining-block/mining-block.component';
import { PeersDialogComponent } from './peers-dialog/peers-dialog.component';
import { BalanceDialogComponent } from './balance-dialog/balance-dialog.component';

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
    EventsComponent,
    ConsensusDialogComponent,
    ConfirmDialogModule,
    PeersDialogComponent,
    MiniBlockchainComponent,
    BalanceDialogComponent,
  ],
  templateUrl: './miner.component.html',
  styleUrls: ['./miner.component.scss'],
  providers: [ConfirmationService],
})
export class MinerComponent {
  slideXValue = 'translateX(100%)';
  isBlockchainVisible = true;

  networkVersions$!: Observable<IConsensusParameters[]>;

  @Input() miner!: Node;
  @Output() miningChanged = new EventEmitter<Node>();
  @Output() minerRemoved = new EventEmitter<Node>();
  @Output() collapsedChange = new EventEmitter<Node>();
  @Output() maximizedChange = new EventEmitter<Node>();
  @Output() logsMaximizedChange = new EventEmitter<Node>();
  @Output() hashRateChange = new EventEmitter<number | null>();
  @Output() transactionBroadcasted = new EventEmitter<{
    minerId: number;
    transaction: Transaction;
  }>();
  @Output() connectToPeersRequested = new EventEmitter<Node>();

  isCollapsedHashRateSelectorOpen = false;

  hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '10 H/s', value: 10 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];

  showConsensusDialog = false;
  showPeersDialog = false;
  showAddressesDialog = false;

  constructor(
    private addressService: AddressService,
    private elRef: ElementRef,
    private confirmationService: ConfirmationService
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

  removeMiner(event: Event) {
    this.confirmationService.confirm({
      target: event.currentTarget as HTMLElement,
      message: 'Tem certeza que deseja remover este minerador?',
      icon: 'pi pi-exclamation-triangle',
      position: 'bottom',
      rejectButtonProps: {
        label: 'Cancelar',
        severity: 'secondary',
        outlined: true,
      },
      acceptButtonProps: {
        label: 'Remover',
        severity: 'danger',
      },
      accept: () => {
        this.stopMining();
        this.minerRemoved.emit(this.miner);
      },
      reject: () => {
        // Do nothing
      },
    });
  }

  setHashRate(rate: number | null) {
    this.miner.hashRate = rate;
    if (this.miner.isMining) {
      this.stopMining();
      this.startMining();
    }

    this.hashRateChange.emit(rate);
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

  confirmRemoveMiner() {
    this.confirmationService.confirm({
      message:
        'Tem certeza que deseja remover este minerador? Esta ação não pode ser desfeita.',
      header: 'Confirmação',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remover',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      accept: () => {
        this.stopMining();
        this.minerRemoved.emit(this.miner);
      },
    });
  }

  onConsensusVersionChange() {
    // Recomeçar a mineração do bloco atual para que seja gerado com a nova versão do consenso
    const latestBlock = this.miner.getLatestBlock();
    this.miner.currentBlock = this.miner.initBlockTemplate(latestBlock);
  }

  connectToPeers() {
    if (this.miner.isSearchingPeers) return;

    this.connectToPeersRequested.emit(this.miner);
  }

  openPeersDialog() {
    this.showPeersDialog = true;
  }

  closePeersDialog() {
    this.showPeersDialog = false;
  }

  // Status color para o indicador de conexão
  get statusColor(): string {
    if (this.miner.peers.length === 0) {
      return 'red';
    }
    if (this.miner.isSyncing) {
      return 'blue';
    }
    return 'green';
  }

  get utxos() {
    return this.miner.balances[this.miner.miningAddress]?.utxos || [];
  }

  get balance() {
    return this.miner.balances[this.miner.miningAddress]?.balance || 0;
  }
}
