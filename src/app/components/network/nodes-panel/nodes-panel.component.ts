import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Node } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { EventsComponent } from '../events/events.component';
import { ConsensusDialogComponent } from '../miners-panel/miner/consensus-dialog/consensus-dialog.component';

@Component({
  selector: 'app-nodes-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EventsComponent,
    ConsensusDialogComponent,
  ],
  templateUrl: './nodes-panel.component.html',
  styleUrls: ['./nodes-panel.component.scss'],
})
export class NodesPanelComponent {
  nodes: Node[] = [];
  showConsensusDialog = false;
  consensusNode: Node | null = null;

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
    this.network.addNode(false);
  }

  removeNode(index: number) {
    const node = this.nodes[index];
    if (node) {
      this.network.removeNode(node.id!);
    }
  }

  showLogs() {}

  closeLogs() {}

  getStatusColor(node: Node): string {
    if (node.peers.length === 0) {
      return 'red';
    }
    if (node.isSyncing) {
      return 'blue';
    }
    return 'green';
  }

  searchPeers(node: Node) {
    node.searchPeersToConnect(this.network.nodes);
  }

  editConsensusParams(node: Node) {
    this.consensusNode = node;
    this.showConsensusDialog = true;
  }

  closeConsensusDialog() {
    this.showConsensusDialog = false;
    this.consensusNode = null;
  }
}
