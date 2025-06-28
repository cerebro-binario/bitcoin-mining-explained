import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { BlockDetailsComponent } from './block-details.component';
import { Block } from '../../../models/block.model';

@Component({
  selector: 'app-block-details-page',
  standalone: true,
  imports: [CommonModule, RouterModule, BlockDetailsComponent],
  template: `
    <ng-container *ngIf="block; else notFound">
      <app-block-details [block]="block"></app-block-details>
    </ng-container>
    <ng-template #notFound>
      <div class="min-h-screen flex items-center justify-center text-zinc-400">
        Bloco não encontrado.
      </div>
    </ng-template>
  `,
})
export class BlockDetailsPage {
  block?: Block;
  nodeId?: number;

  constructor(
    private route: ActivatedRoute,
    private network: BitcoinNetworkService
  ) {
    this.route.params.subscribe((params) => {
      this.nodeId = +params['id'];
      const height = +params['height'];
      const node = this.network.nodes.find((n) => n.id === this.nodeId);
      this.block = node?.getBlocksByHeight(height)?.[0];
    });
  }
}
