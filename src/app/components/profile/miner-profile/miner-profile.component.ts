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
import { WalletComponent } from '../../network/wallet/wallet.component';

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
  ],
})
export class MinerProfileComponent {
  miner!: BitcoinNode;
  activeTab: 'metadata' | 'transactions' = 'metadata';
  showAllLogs = false;
  isBlockchainVisible = true;
  showWalletDetails = false;
  displayModeBlockchainBalance: 'all-private-keys' | 'with-balance' =
    'with-balance';
  walletBipFormat: BipType | 'all-bip-types' = 'bip84';
  chainBipFormat: BipType | 'all-bip-types' = 'bip84';
  hashRateOptions = [
    { label: '1 H/s', value: 1 },
    { label: '1k H/s', value: 1000 },
    { label: '10k H/s', value: 10000 },
    { label: 'Máximo', value: null },
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
    this.route.queryParams.subscribe((params) => {
      this.showWalletDetails = params['wallet'] === 'open';
      if (params['displayMode']) {
        this.displayModeBlockchainBalance = params['displayMode'] as
          | 'all-private-keys'
          | 'with-balance';
      }
      if (params['tab']) {
        this.activeTab = params['tab'] as 'metadata' | 'transactions';
      }
      if (params['walletBipFormat']) {
        this.walletBipFormat = params['walletBipFormat'] as BipType;
      }
      if (params['chainBipFormat']) {
        this.chainBipFormat = params['chainBipFormat'] as BipType;
      }
      if (params['blockchain'] !== undefined) {
        this.isBlockchainVisible = params['blockchain'] === 'open';
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
    this.isBlockchainVisible = !this.isBlockchainVisible;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { blockchain: this.isBlockchainVisible ? 'open' : 'closed' },
      queryParamsHandling: 'merge',
    });
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
    this.showWalletDetails = !this.showWalletDetails;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { wallet: this.showWalletDetails ? 'open' : null },
      queryParamsHandling: 'merge',
    });
  }

  onBlockchainBalanceDisplayModeChange(
    mode: 'all-private-keys' | 'with-balance'
  ) {
    this.displayModeBlockchainBalance = mode;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { displayMode: mode },
      queryParamsHandling: 'merge',
    });
  }

  setActiveTab(tab: 'metadata' | 'transactions') {
    this.activeTab = tab;
    const queryParams = { ...this.route.snapshot.queryParams, tab };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  onWalletBipFormatChange(format: BipType | 'all-bip-types') {
    this.walletBipFormat = format;
    const queryParams = {
      ...this.route.snapshot.queryParams,
      walletBipFormat: format,
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  onChainBipFormatChange(format: BipType | 'all-bip-types') {
    this.chainBipFormat = format;
    const queryParams = {
      ...this.route.snapshot.queryParams,
      chainBipFormat: format,
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
