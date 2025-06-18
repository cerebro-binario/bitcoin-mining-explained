import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import type { Node as BitcoinNode } from '../../../models/node';
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
  ],
})
export class MinerProfileComponent {
  miner!: BitcoinNode;
  activeTab: 'metadata' | 'transactions' = 'metadata';
  showAllLogs = false;
  isBlockchainVisible = true;
  showWalletDetails = false;

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
      )!;
      if (!this.miner) {
        this.router.navigate(['/network/overview']);
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
}
