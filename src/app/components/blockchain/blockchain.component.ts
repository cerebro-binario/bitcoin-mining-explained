import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { Block } from '../../models/block.model';
import { BlockchainService } from '../../services/blockchain.service';

@Component({
  selector: 'app-blockchain',
  imports: [TableModule, ButtonModule, ToolbarModule, RouterModule],
  templateUrl: './blockchain.component.html',
  styleUrl: './blockchain.component.scss',
})
export class BlockchainComponent {
  blocks: Block[] = [];

  constructor(private blockchainService: BlockchainService) {
    this.blocks = this.blockchainService.getBlockchain();
  }
}
