import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import type { Node as BitcoinNode } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { WalletComponent } from '../../network/wallet/wallet.component';

@Component({
  selector: 'app-miner-profile',
  templateUrl: './miner-profile.component.html',
  styleUrls: ['./miner-profile.component.scss'],
  imports: [CommonModule, RouterModule, WalletComponent],
})
export class MinerProfileComponent {
  miner: BitcoinNode | undefined;
  activeTab: 'metadata' | 'transactions' = 'metadata';

  constructor(
    private route: ActivatedRoute,
    public bitcoinNetwork: BitcoinNetworkService
  ) {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.miner = this.bitcoinNetwork.nodes.find(
        (n) => n.id === id && n.nodeType === 'miner'
      );
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
}
