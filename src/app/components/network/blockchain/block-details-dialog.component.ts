import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Block } from '../../../models/block.model';
import { Node } from '../../../models/node';
import { BlockDetailsComponent } from './block-details.component';

@Component({
  selector: 'app-block-details-dialog',
  standalone: true,
  imports: [CommonModule, BlockDetailsComponent],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-stretch justify-stretch"
      (click)="onBackdropClick($event)"
    >
      <div
        class="w-full h-full bg-zinc-900 flex flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between p-6 border-b border-zinc-700 bg-zinc-800"
        >
          <div class="flex items-center gap-4">
            <div>
              <h2 class="text-xl font-bold text-zinc-200">
                Detalhes do Bloco #{{ block.height }}
              </h2>
              <div
                class="font-mono text-xs text-blue-300 break-all mt-1 max-w-[600px] truncate"
              >
                Hash: {{ block.hash }}
              </div>
            </div>
            <span
              *ngIf="!isActiveBlock()"
              class="px-2 py-1 text-xs bg-red-900/50 text-red-300 rounded border border-red-700"
            >
              Fork Inativo
            </span>
          </div>

          <!-- Navigation and Close -->
          <div class="flex items-center gap-2">
            <!-- Navigation -->
            <div class="flex items-center gap-2 mr-4">
              <button
                (click)="goPrevBlock.emit()"
                [disabled]="!hasPrevBlock"
                class="px-3 py-1.5 rounded border text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                [ngClass]="
                  hasPrevBlock
                    ? 'border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20'
                    : 'border-zinc-600 bg-transparent text-zinc-400'
                "
                title="Bloco anterior"
              >
                <i class="pi pi-chevron-left mr-1"></i>
                Anterior
              </button>
              <button
                (click)="goNextBlock.emit()"
                [disabled]="!hasNextBlock"
                class="px-3 py-1.5 rounded border text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                [ngClass]="
                  hasNextBlock
                    ? 'border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20'
                    : 'border-zinc-600 bg-transparent text-zinc-400'
                "
                title="Próximo bloco"
              >
                Próximo
                <i class="pi pi-chevron-right ml-1"></i>
              </button>
            </div>

            <!-- Close Button -->
            <button
              (click)="onClose.emit()"
              class="p-2 rounded-lg border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
              title="Fechar (ESC)"
            >
              <i class="pi pi-times text-zinc-400"></i>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto">
          <app-block-details
            [block]="block!"
            [node]="node!"
            [hasPrevBlock]="hasPrevBlock"
            [hasNextBlock]="hasNextBlock"
            (goPrevBlock)="goPrevBlock.emit()"
            (goNextBlock)="goNextBlock.emit()"
          ></app-block-details>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class BlockDetailsDialogComponent {
  @Input() isOpen: boolean = false;
  @Input() block!: Block;
  @Input() node!: Node;
  @Input() hasPrevBlock: boolean = false;
  @Input() hasNextBlock: boolean = false;

  @Output() onClose = new EventEmitter<void>();
  @Output() goPrevBlock = new EventEmitter<void>();
  @Output() goNextBlock = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent) {
    // Só fecha se clicou no backdrop, não no conteúdo
    if (event.target === event.currentTarget) {
      this.onClose.emit();
    }
  }

  isActiveBlock(): boolean {
    if (!this.node || !this.block) return false;
    for (const h of this.node.heights) {
      for (const bn of h.blocks) {
        if (bn.block.hash === this.block.hash) {
          return bn.isActive;
        }
      }
    }
    return false;
  }
}
