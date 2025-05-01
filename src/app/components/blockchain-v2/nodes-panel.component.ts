import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';

@Component({
  selector: 'app-nodes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nodes-panel.component.html',
  styleUrls: ['./nodes-panel.component.scss'],
})
export class NodesPanelComponent {
  constructor(public network: BitcoinNetworkService) {}

  get nodes() {
    return this.network.nodes.filter((n) => !n.isMiner);
  }

  addNode() {
    this.network.addNode(false);
  }

  removeNode(index: number) {
    const node = this.nodes[index];
    if (node) {
      this.network.removeNode(node.id!);
    }
  }
}
