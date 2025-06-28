import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
      <app-block-details
        [block]="block"
        [node]="node"
        [hasPrevBlock]="!!prevBlock"
        [hasNextBlock]="!!nextBlock"
        (goPrevBlock)="goToBlock(prevBlock)"
        (goNextBlock)="goToBlock(nextBlock)"
      ></app-block-details>
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
  prevBlock?: { height: number; hash: string };
  nextBlock?: { height: number; hash: string };

  constructor(
    private route: ActivatedRoute,
    private network: BitcoinNetworkService,
    private router: Router
  ) {
    this.route.params.subscribe((params) => {
      this.nodeId = +params['id'];
      const height = +params['height'];
      const hash = params['hash'];
      this.node = this.network.nodes.find((n) => n.id === this.nodeId);
      this.block = this.node?.heights
        ?.find((h) => h.n === height)
        ?.blocks.find((bn) => bn.block.hash === hash)?.block;
      this.updatePrevNext(height, hash);
    });
  }

  updatePrevNext(height: number, hash: string) {
    if (!this.node) {
      this.prevBlock = undefined;
      this.nextBlock = undefined;
      return;
    }
    // Prev block: menor height, ou outro hash na mesma height
    const prevHeight = this.node.heights.find((h) => h.n === height - 1);
    this.prevBlock =
      prevHeight && prevHeight.blocks.length > 0 && prevHeight.n !== -1
        ? { height: prevHeight.n, hash: prevHeight.blocks[0].block.hash }
        : undefined;
    // Next block: maior height, ou outro hash na mesma height
    const nextHeight = this.node.heights.find((h) => h.n === height + 1);
    this.nextBlock =
      nextHeight && nextHeight.blocks.length > 0
        ? { height: nextHeight.n, hash: nextHeight.blocks[0].block.hash }
        : undefined;
  }

  goToBlock(blockInfo?: { height: number; hash: string }) {
    if (!blockInfo || !this.nodeId) return;
    this.router.navigate([
      '/miners',
      this.nodeId,
      'blocks',
      blockInfo.height,
      blockInfo.hash,
    ]);
  }
}
