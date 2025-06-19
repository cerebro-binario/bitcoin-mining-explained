import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import type { Node as BitcoinNode } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { KeyService } from '../../../services/key.service';
import { BlockchainComponent } from '../../network/blockchain/blockchain.component';
import { EventComponent } from '../../network/events/event/event.component';
import { BlockchainBalanceComponent } from '../../network/miners-panel/miner/blockchain-balance.component';
import { WalletComponent } from '../../network/wallet/wallet.component';
import { BipType } from '../../../models/wallet.model';

@Component({
  selector: 'app-peer-profile',
  templateUrl: './peer-profile.component.html',
  styleUrls: ['./peer-profile.component.scss'],
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
export class PeerProfileComponent {
  node!: BitcoinNode;
  activeTab: 'metadata' | 'transactions' = 'metadata';
  showAllLogs = false;
  isBlockchainVisible = true;
  showWalletDetails = false;
  displayModeBlockchainBalance: 'all-private-keys' | 'with-balance' =
    'with-balance';
  walletBipFormat: BipType | 'all-bip-types' = 'bip84';
  chainBipFormat: BipType | 'all-bip-types' = 'bip84';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private networkService: BitcoinNetworkService,
    private keyService: KeyService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const nodeId = parseInt(params['id']);
      this.node = this.networkService.nodes.find(
        (n) => n.id === nodeId && n.nodeType === 'peer'
      ) as BitcoinNode;
      if (!this.node) {
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

  getTotalBalanceBTC(): string {
    if (!this.node?.wallet?.addresses) return '0';
    const sum = this.node.wallet.addresses.reduce((acc, address) => {
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
    if (!this.node?.wallet?.addresses) return 0;
    return this.node.wallet.addresses.reduce((acc, address) => {
      return (
        acc +
        Object.values(address).reduce(
          (a, addrData) => a + (addrData.utxos?.length || 0),
          0
        )
      );
    }, 0);
  }

  getTotalBalanceUSD(): string | null {
    const btc = parseFloat(this.getTotalBalanceBTC().replace(',', ''));
    if (!btc) return null;
    const usd = btc * 65000; // mock price
    return usd.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  }

  copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }

  deriveNextAddress() {
    if (!this.node?.wallet) return;

    const newAddress = this.keyService.deriveNextBitcoinAddress(
      this.node.wallet
    );

    if (newAddress) {
      Object.values(newAddress).forEach(
        (address) => (address.nodeId = this.node.id)
      );
      const newWallet = { ...this.node.wallet };
      newWallet.addresses = [...newWallet.addresses, newAddress];
      this.node.wallet = newWallet;
    }
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
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  onWalletBipFormatChange(format: BipType | 'all-bip-types') {
    this.walletBipFormat = format;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { walletBipFormat: format },
      queryParamsHandling: 'merge',
    });
  }

  onChainBipFormatChange(format: BipType | 'all-bip-types') {
    this.chainBipFormat = format;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { chainBipFormat: format },
      queryParamsHandling: 'merge',
    });
  }

  toggleWalletDetails() {
    this.showWalletDetails = !this.showWalletDetails;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { wallet: this.showWalletDetails ? 'open' : 'closed' },
      queryParamsHandling: 'merge',
    });
  }

  // Métodos específicos para full nodes
  getNodeStatus(): string {
    // Para full nodes, consideramos online se tem peers conectados
    return this.node.peers.length > 0 ? 'Online' : 'Offline';
  }

  getNodeStatusClass(): string {
    return this.node.peers.length > 0
      ? 'bg-green-900 text-green-400'
      : 'bg-red-900 text-red-400';
  }

  getBlockHeight(): number {
    return this.node.heights.length > 0 ? this.node.heights.length - 1 : 0;
  }

  getLatestBlock() {
    return this.node.getLatestBlock();
  }

  getConnectedPeersCount(): number {
    return this.node.peers.length;
  }

  getNodeUptime(): string {
    // Mock uptime baseado no tempo desde a criação do nó
    const now = Date.now();
    const uptime = Math.floor((now - (this.node as any).createdAt) / 1000) || 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  getNetworkVersion(): string {
    return this.node.consensus.version.toString();
  }

  getBandwidthUsage(): string {
    // Mock bandwidth baseado no número de peers
    const bandwidth = this.node.peers.length * 50; // 50 KB/s por peer
    if (bandwidth > 1024) {
      return `${(bandwidth / 1024).toFixed(1)} MB/s`;
    }
    return `${bandwidth} KB/s`;
  }
}
