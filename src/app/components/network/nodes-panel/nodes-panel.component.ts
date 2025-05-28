import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Node } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { EventsComponent } from '../events/events.component';

@Component({
  selector: 'app-nodes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, EventsComponent],
  templateUrl: './nodes-panel.component.html',
  styleUrls: ['./nodes-panel.component.scss'],
})
export class NodesPanelComponent {
  nodes: Node[] = [];
  constructor(public network: BitcoinNetworkService) {
    this.network.nodes$.pipe(takeUntilDestroyed()).subscribe((nodes) => {
      this.nodes = nodes.filter((n) => !n.isMiner);
    });
  }

  getPeerStatusText(peer: any): string {
    switch (peer.status) {
      case 'pending':
        return 'Aguardando...';
      case 'validating':
        return 'Validando...';
      case 'valid':
        return peer.blockchainLength + ' blocos';
      case 'invalid':
        return 'Inválido';
      default:
        return '';
    }
  }

  addNode() {
    const node = this.network.addNode(false);
    this.network.initializeNode(node);
  }

  removeNode(index: number) {
    const node = this.nodes[index];
    if (node) {
      this.network.removeNode(node.id!);
    }
  }

  showLogs() {}

  closeLogs() {}
}
