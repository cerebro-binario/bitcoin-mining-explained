import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Node } from '../../../../models/node';
import { EventsComponent } from '../../events/events.component';
import { MiniBlockchainComponent } from '../../mini-blockchain/mini-blockchain.component';
import { BlockchainComponent } from '../../blockchain/blockchain.component';

@Component({
  selector: 'app-node',
  standalone: true,
  imports: [
    CommonModule,
    MiniBlockchainComponent,
    EventsComponent,
    BlockchainComponent,
  ],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
})
export class NodeComponent {
  @Input() node!: Node;
  @Input() isMaximized = false;
  @Output() remove = new EventEmitter<Node>();
  @Output() editConsensus = new EventEmitter<Node>();
  @Output() searchPeers = new EventEmitter<Node>();
  @Output() maximizedChange = new EventEmitter<Node>();

  isBlockchainVisible = true;

  getStatusColor(node: Node): string {
    if (node.peers.length === 0) {
      return 'red';
    }
    if (node.isSyncing) {
      return 'blue';
    }
    return 'green';
  }

  toggleMaximized() {
    this.maximizedChange.emit(this.node);
  }

  toggleBlockchainVisibility() {
    this.isBlockchainVisible = !this.isBlockchainVisible;
  }
}
