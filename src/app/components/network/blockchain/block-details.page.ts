import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { BlockDetailsComponent } from './block-details.component';
import { Block } from '../../../models/block.model';
import { Node } from '../../../models/node';
import { Subscription } from 'rxjs';

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
export class BlockDetailsPage implements OnDestroy {
  block?: Block;
  node?: Node;
  nodeId?: number;
  prevBlock?: { height: number; hash: string };
  nextBlock?: { height: number; hash: string };
  private balancesSub?: Subscription;

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
      this.subscribeToBalances(height, hash);
    });
  }

  subscribeToBalances(height: number, hash: string) {
    if (!this.node) return;
    if (this.balancesSub) this.balancesSub.unsubscribe();
    this.balancesSub = this.node.balances$.subscribe(() => {
      // Sempre que o saldo muda, pode ter havido novo bloco
      this.block = this.node?.heights
        ?.find((h) => h.n === height)
        ?.blocks.find((bn) => bn.block.hash === hash)?.block;
      this.updatePrevNext(height, hash);
    });
  }

  ngOnDestroy() {
    this.balancesSub?.unsubscribe();
  }

  updatePrevNext(height: number, hash: string) {
    if (!this.node || !this.block) {
      this.prevBlock = undefined;
      this.nextBlock = undefined;
      return;
    }
    // Prev block: pai direto (hash == previousHash do bloco atual)
    let foundParent: { height: number; hash: string } | undefined = undefined;
    for (const h of this.node.heights) {
      for (const bn of h.blocks) {
        if (
          this.block.previousHash &&
          bn.block.hash === this.block.previousHash
        ) {
          foundParent = { height: h.n, hash: bn.block.hash };
          break;
        }
      }
      if (foundParent) break;
    }
    this.prevBlock =
      foundParent && foundParent.height !== -1 ? foundParent : undefined;
    // Próximo bloco: filho direto (previousHash == hash do bloco atual)
    let foundChild: { height: number; hash: string } | undefined = undefined;
    for (const h of this.node.heights) {
      if (h.n <= height) continue;
      for (const bn of h.blocks) {
        if (bn.block.previousHash === this.block.hash) {
          foundChild = { height: h.n, hash: bn.block.hash };
          break;
        }
      }
      if (foundChild) break;
    }
    this.nextBlock = foundChild;
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
