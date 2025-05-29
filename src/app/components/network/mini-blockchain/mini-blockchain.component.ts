import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Node } from '../../../models/node';

@Component({
  selector: 'app-mini-blockchain',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mini-blockchain.component.html',
  styleUrl: './mini-blockchain.component.scss',
})
export class MiniBlockchainComponent {
  @Input() node!: Node;

  get lastMainBlocks() {
    return this.node?.lastMainBlocks || [];
  }
}
