import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { BlockDetailsComponent } from './block-details.component';
import { Block } from '../../../models/block.model';
import { Node } from '../../../models/node';

@Component({
  selector: 'app-block-details-page',
  standalone: true,
  imports: [CommonModule, RouterModule, BlockDetailsComponent],
  template: `
    <ng-container *ngIf="block && node; else notFound">
      <app-block-details [block]="block" [node]="node"></app-block-details>
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
  node?: Node;
  nodeId?: number;

  constructor(
    private route: ActivatedRoute,
    private network: BitcoinNetworkService
  ) {
    this.route.params.subscribe((params) => {
      this.nodeId = +params['id'];
      const height = +params['height'];
      const hash = params['hash'];
      this.node = this.network.nodes.find((n) => n.id === this.nodeId);
      this.block = this.node?.heights
        ?.find((h) => h.n === height)
        ?.blocks.find((bn) => bn.block.hash === hash)?.block;
    });
  }
}
