import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import type { Node as BitcoinNode } from '../../../models/node';
import { BipType } from '../../../models/wallet.model';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { KeyService } from '../../../services/key.service';
import { BlockchainComponent } from '../../network/blockchain/blockchain.component';
import { EventComponent } from '../../network/events/event/event.component';
import { BlockchainBalanceComponent } from '../../network/miners-panel/miner/blockchain-balance.component';
import { ConsensusDialogComponent } from '../../network/miners-panel/miner/consensus-dialog/consensus-dialog.component';
import { WalletComponent } from '../../network/wallet/wallet.component';
import { UtxoComponent } from '../../shared/utxo/utxo.component';

@Component({
  selector: 'app-miner-profile',
  templateUrl: './miner-profile.component.html',
  styleUrls: ['./miner-profile.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    WalletComponent,
    EventComponent,
    BlockchainComponent,
    BlockchainBalanceComponent,
    FormsModule,
    SelectModule,
    UtxoComponent,
    ConsensusDialogComponent,
  ],
})
export class MinerProfileComponent {
  miner!: BitcoinNode;
  showAllLogs = false;
  showConsensusDialog = false;
  hashRateOptions = [
    { value: 1, label: '1 H/s' },
    { value: 1000, label: '1.000 H/s' },
    { value: 10000, label: '10.000 H/s' },
    { value: null, label: 'Máximo' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private networkService: BitcoinNetworkService,
    private keyService: KeyService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const minerId = parseInt(params['id']);
      this.miner = this.networkService.nodes.find(
        (n) => n.id === minerId && n.nodeType === 'miner'
      ) as BitcoinNode;
      if (!this.miner) {
        this.router.navigate(['/']);
      }
    });
  }

  showNodeLogs() {
    this.showAllLogs = true;
  }

  closeLogs() {
    this.showAllLogs = false;
  }

  toggleBlockchainVisibility() {
    this.miner.pageState.blockchain =
      this.miner.pageState.blockchain === 'open' ? 'closed' : 'open';
  }

  startMining() {
    if (!this.miner || this.miner.isMining) return;

    // Cria um novo bloco se não houver um atual
    if (!this.miner.currentBlock) {
      this.miner.currentBlock = this.miner.initBlockTemplate();
    }

    this.miner.isMining = true;
    this.miner.miningLastTickTime = Date.now();
  }

  stopMining() {
    if (!this.miner || !this.miner.isMining) return;

    this.miner.isMining = false;
    this.miner.miningLastTickTime = null;
  }

  getTarget(block: any): string {
    if (!block?.target) return '0';
    return '0x' + block.target.toString(16).padStart(64, '0');
  }

  deriveNextAddress() {
    if (!this.miner?.wallet) return;

    const newAddress = this.keyService.deriveNextBitcoinAddress(
      this.miner.wallet
    );

    if (newAddress) {
      Object.values(newAddress).forEach(
        (address) => (address.nodeId = this.miner.id)
      );
      const newWallet = { ...this.miner.wallet };
      newWallet.addresses = [...newWallet.addresses, newAddress];
      this.miner.wallet = newWallet;
    }
  }

  getTotalBalanceBTC(): string {
    if (!this.miner?.wallet?.addresses) return '0';
    const sum = this.miner.wallet.addresses.reduce((acc, address) => {
      return (
        acc +
        Object.values(address).reduce(
          (a, addrData) => a + (addrData.balance || 0),
          0
        )
      );
    }, 0);
    return (sum / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8 });
  }

  getTotalUtxos(): number {
    if (!this.miner?.wallet?.addresses) return 0;
    return this.miner.wallet.addresses.reduce((acc, address) => {
      return (
        acc +
        Object.values(address).reduce(
          (a, addrData) => a + (addrData.utxos?.length || 0),
          0
        )
      );
    }, 0);
  }

  copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }

  setPresetHashRate(val: number) {
    this.miner.hashRate = val;
  }

  setMaxHashRate() {
    this.miner.hashRate = null;
  }

  onHashRateDropdownChange(val: number | null) {
    this.miner.hashRate = val;
  }

  toggleWalletDetails() {
    this.miner.pageState.wallet =
      this.miner.pageState.wallet === 'open' ? 'closed' : 'open';
  }

  onBlockchainBalanceDisplayModeChange(
    mode: 'all-private-keys' | 'with-balance'
  ) {
    this.miner.pageState.blockchainBalanceDisplayMode = mode;
  }

  setActiveTab(tab: 'metadata' | 'transactions') {
    this.miner.pageState.currentBlockTab = tab;
  }

  onWalletBipFormatChange(format: BipType | 'all-bip-types') {
    this.miner.pageState.walletBipFormat = format;
  }

  onChainBipFormatChange(format: BipType | 'all-bip-types') {
    this.miner.pageState.blockchainBipFormat = format;
  }

  get walletAddresses(): string[] {
    if (!this.miner?.wallet?.addresses) return [];
    return this.miner.wallet.addresses.flatMap((addrObj) =>
      Object.values(addrObj).map((addr) => addr.address)
    );
  }

  openConsensusDialog() {
    this.showConsensusDialog = true;
  }

  closeConsensusDialog() {
    this.showConsensusDialog = false;
  }

  onConsensusVersionChange() {
    // Recomeçar a mineração do bloco atual para que seja gerado com a nova versão do consenso
    const latestBlock = this.miner.getLatestBlock();
    this.miner.currentBlock = this.miner.initBlockTemplate(latestBlock);
  }

  onWalletActiveTabChange(tab: 'enderecos' | 'transacoes' | 'enviar') {
    this.miner.pageState.walletActiveTab = tab;
  }
}
