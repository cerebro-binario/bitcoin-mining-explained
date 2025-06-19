import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import type { Node as BitcoinNode } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { GraphPlotComponent } from '../graph-plot/graph-plot.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-network-overview',
  templateUrl: './network-overview.component.html',
  imports: [GraphPlotComponent, CommonModule],
})
export class NetworkOverviewComponent {
  selectedEntity: BitcoinNode | null = null;

  constructor(
    public bitcoinNetwork: BitcoinNetworkService,
    private router: Router
  ) {}

  addMiner() {
    this.bitcoinNetwork.addNode('miner');
  }

  addNode() {
    this.bitcoinNetwork.addNode('peer');
  }

  addUser() {
    this.bitcoinNetwork.addNode('user');
  }

  onEntitySelected(node: BitcoinNode) {
    this.selectedEntity = node;
    if (node.nodeType === 'miner') {
      this.router.navigate(['/miners', node.id]);
    } else if (node.nodeType === 'peer') {
      this.router.navigate(['/peers', node.id]);
    } else if (node.nodeType === 'user') {
      this.router.navigate(['/users', node.id]);
    }
  }
}
