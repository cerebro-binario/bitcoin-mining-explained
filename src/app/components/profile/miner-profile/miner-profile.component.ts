import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import type { Node as BitcoinNode } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';

@Component({
  selector: 'app-miner-profile',
  templateUrl: './miner-profile.component.html',
  styleUrls: ['./miner-profile.component.scss'],
  imports: [CommonModule, RouterModule],
})
export class MinerProfileComponent {
  miner: BitcoinNode | undefined;

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
}
