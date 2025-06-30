import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { Block } from '../../../models/block.model';
import type { Node as BitcoinNode } from '../../../models/node';
import { BipType } from '../../../models/wallet.model';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { KeyService } from '../../../services/key.service';
import { BlockchainComponent } from '../../network/blockchain/blockchain.component';
import { EventComponent } from '../../network/events/event/event.component';
import { BlockchainBalanceComponent } from '../../network/miners-panel/miner/blockchain-balance.component';
import { WalletComponent } from '../../network/wallet/wallet.component';

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
export class PeerProfileComponent implements OnInit {
  node!: BitcoinNode;
  showAllLogs = false;

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
  }

  showNodeLogs() {
    this.showAllLogs = true;
  }

  closeLogs() {
    this.showAllLogs = false;
  }

  toggleBlockchainVisibility() {
    this.node.pageState.blockchain =
      this.node.pageState.blockchain === 'open' ? 'closed' : 'open';
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
    this.node.pageState.blockchainBalanceDisplayMode = mode;
  }

  setActiveTab(tab: 'metadata' | 'transactions') {
    this.node.pageState.currentBlockTab = tab;
  }

  onWalletBipFormatChange(format: BipType | 'all-bip-types') {
    this.node.pageState.walletBipFormat = format;
  }

  onChainBipFormatChange(format: BipType | 'all-bip-types') {
    this.node.pageState.blockchainBipFormat = format;
  }

  toggleWalletDetails() {
    this.node.pageState.wallet =
      this.node.pageState.wallet === 'open' ? 'closed' : 'open';
  }

  getNodeStatus(): string {
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

  getLatestBlock(): Block | null {
    const block = this.node.getLatestBlock();
    return block || null;
  }

  getConnectedPeersCount(): number {
    return this.node.peers.length;
  }

  getNodeUptime(): string {
    const now = Date.now();
    const uptime = Math.floor((now - (this.node as any).createdAt) / 1000) || 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  getBandwidthUsage(): string {
    const bandwidth = this.node.peers.length * 50; // 50 KB/s por peer
    if (bandwidth > 1024) {
      return `${(bandwidth / 1024).toFixed(1)} MB/s`;
    }
    return `${bandwidth} KB/s`;
  }

  getTarget(block: Block | null): string {
    if (!block) return '0'.repeat(64);
    return block.target.toString(16).padStart(64, '0');
  }

  onWalletActiveTabChange(tab: 'enderecos' | 'transacoes' | 'enviar') {
    this.node.pageState.walletActiveTab = tab;
  }
}
