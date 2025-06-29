import { animate, style, transition, trigger } from '@angular/animations';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { Node } from '../../../models/node';
import { Block, BlockNode } from '../../../models/block.model';
import { Height } from '../../../models/height.model';
import { EventLogMessagePipe } from '../events/event/event-log/event-log-message.pipe';
import { EventLogVisualPipe } from '../events/event/event-log/event-log-visual.pipe';
import { BlockDetailsDialogComponent } from './block-details-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    EventLogVisualPipe,
    EventLogMessagePipe,
    ScrollingModule,
    BlockDetailsDialogComponent,
  ],
  animations: [
    trigger('blockAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.5s ease-out', style({ opacity: 1 })),
      ]),
    ]),
    trigger('slideRightAnimation', [
      transition(
        ':increment',
        [style({ transform: '{{slideXValue}}' }), animate('0.5s ease-out')],
        {
          params: {
            slideXValue: 'translateX(0)',
          },
        }
      ),
    ]),
  ],
})
export class BlockchainComponent implements OnDestroy {
  slideXValue = 'translateX(0)';

  // Propriedades para o cálculo de gaps
  hasCalculatedGaps = false;
  blockchainContainerHeight = 0;
  itemSize = 352;
  nToleratedItems = 10;
  connectorViewbox = { w: 100, h: 100 };
  gap = {
    x: {
      value: 0,
      percentage: 0,
    },
    y: {
      value: 0,
      percentage: 0,
    },
  };

  // Dialog properties
  isDialogOpen = false;
  selectedBlock: Block | null = null;
  hasPrevBlock = false;
  hasNextBlock = false;

  @Input() node!: Node;

  private balancesSub?: Subscription;

  constructor(private router: Router) {}

  // Método chamado após a view ser inicializada
  ngAfterViewInit() {
    // Verifica se existe algum bloco minerado
    const hasBlocks = this.node.heights.length > 1;
    if (hasBlocks) {
      requestAnimationFrame(() => {
        this.calculateGaps();
      });
    }

    // Adiciona listener para ESC
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    this.balancesSub = this.node.balances$.subscribe(() => {
      if (this.isDialogOpen && this.selectedBlock) {
        this.calculateNavigationState(this.selectedBlock);
      }
    });
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isDialogOpen) {
      this.onDialogClose();
    }
  }

  // Método para calcular os gaps
  calculateGaps() {
    const container = document.querySelector(
      `#blockchain-container-${this.node.id}`
    ) as HTMLElement;
    this.calculateVirtualScrollHeight(container);

    if (this.hasCalculatedGaps) return;

    const containerComputedStyle = window.getComputedStyle(container);
    this.gap.x.value =
      parseFloat(containerComputedStyle.getPropertyValue('gap')) || 0;

    // Calcular gap vertical
    const heightContainer = document.querySelector(
      '.height-element-container'
    ) as HTMLElement;

    const heightComputedStyle = window.getComputedStyle(heightContainer);
    this.gap.y.value =
      parseFloat(heightComputedStyle.getPropertyValue('gap')) || 0;

    const heightElement = document.querySelector(
      '.height-element'
    ) as HTMLElement;
    const blockElement = document.querySelector(
      '.block-element'
    ) as HTMLElement;

    const heightWidth = heightElement.getBoundingClientRect().width;
    const blockWidth = blockElement.getBoundingClientRect().width;
    const blockHeight = blockElement.getBoundingClientRect().height;

    this.gap.x.percentage = (this.gap.x.value / heightWidth) * 100;
    this.gap.y.percentage = (this.gap.y.value / blockHeight) * 100;

    this.connectorViewbox = { w: blockWidth, h: blockHeight };

    requestAnimationFrame(() => {
      this.slideXValue = `translateX(calc(-1 * (${this.connectorViewbox.w}px + ${this.gap.x.value}px)))`;
    });

    const containerWidth = container.getBoundingClientRect().width;
    this.itemSize = blockWidth + this.gap.x.value;
    this.nToleratedItems = Math.ceil(containerWidth / this.itemSize) * 2;

    this.hasCalculatedGaps = true;
  }

  calculateVirtualScrollHeight(container: HTMLElement) {
    if (!container) return;

    requestAnimationFrame(() => {
      this.blockchainContainerHeight =
        container.getBoundingClientRect().height + this.getScrollbarSize();
    });
  }

  // Método para obter a cor de fundo do bloco
  getBlockBackgroundColor(node: BlockNode): string {
    if (!node.isActive) return 'bg-zinc-700/50'; // fundo mais escuro para dead forks
    return 'bg-zinc-800'; // fundo padrão para main chain
  }

  // Método para obter a cor da borda do bloco
  getBlockBorderColor(node: BlockNode): string {
    if (!node.isActive) return 'border-zinc-600/50'; // borda mais clara para dead forks
    return 'border-zinc-600'; // borda padrão para main chain
  }

  // Calcula o caminho curvo para a conexão
  getCurvedPath(miner: Node, node: BlockNode, height: number): string {
    const parent = node.parent;
    if (!parent) return '';

    let hTotal = parent.children.length;
    let h = parent.children.findIndex((c) => c.block.hash === node.block.hash);

    const prevPosition = miner.heights[height + 1]?.blocks.findIndex(
      (b) => b.block.hash === parent.block.hash
    );
    const currPosition = miner.heights[height]?.blocks.findIndex(
      (b) => b.block.hash === node.block.hash
    );
    const startX = this.connectorViewbox.w;
    const startY = this.connectorViewbox.h / 2;

    // Calcula a posição final do bloco filho
    const endX = this.connectorViewbox.w + this.gap.x.value;
    let endY =
      (this.getDynamicTopValue(hTotal, h) / 100) * this.connectorViewbox.h +
      (this.connectorViewbox.h + this.gap.y.value) *
        (prevPosition - currPosition);

    // Caso o pai seja o origin block (fake) e tenha um fork logo no genesis
    if (parent.block.height === -1 && hTotal > 1) {
      endY =
        ((50 * hTotal) / 100) * this.connectorViewbox.h +
        (this.connectorViewbox.h + this.gap.y.value) *
          (prevPosition - currPosition) +
        (this.gap.y.value / 2) * (hTotal - 1);
    }
    // Ponto de controle para a curva
    const midX = (startX + endX) / 2; // Ponto no meio do caminho horizontalmente

    // **AUMENTAMOS** a distância dos pontos de controle para criar uma curva mais acentuada
    const controlX1 = startX + (midX - startX) * 1.15; // Puxa mais a curva na 1ª metade
    const controlX2 = endX + (midX - endX) * 1.15; // Puxa mais a curva na 2ª metade

    const controlY1 = startY;
    const controlY2 = endY;

    return `M ${startX},${startY} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${endX},${endY}`;
  }

  // Retorna a cor da conexão
  getConnectionStrokeColor(node: BlockNode, isResolved: boolean): string {
    if (isResolved) return '#6b7280'; // cinza mais claro para main chain
    if (!node.isActive) return '#4b5563'; // cinza neutro para dead forks
    return '#6b7280'; // cinza mais claro para conexões em andamento
  }

  // Calcula o valor dinâmico para o topo da conexão
  getDynamicTopValue(total: number, index: number): number {
    return (100 / (total + 1)) * (index + 1);
  }

  // Verifica se a altura está resolvida (todos os blocos da altura estão na main chain)
  isHeightResolved(height: number): boolean {
    const blocks = this.node.heights[height]?.blocks;
    const activeBlocks = blocks.filter((b) => b.isActive).length; // Conta apenas blocos ativos
    return activeBlocks === 1;
  }

  getOriginBlockTransform(childrenLength: number): string {
    const originBlock = document.querySelector(
      `#originBlock-${this.node.id}`
    ) as HTMLElement;
    const { width, height } = originBlock.getBoundingClientRect();

    const translateX = Math.round((width / 2) * -1);
    const translateY = Math.round(
      (this.connectorViewbox.h * childrenLength) / 2 -
        height / 2 +
        (this.gap.y.value / 2) * childrenLength
    );

    return 'translate(' + translateX + 'px, ' + translateY + 'px)';
  }

  getScrollbarSize(): number {
    // Cria um elemento temporário
    const scrollDiv = document.createElement('div');
    scrollDiv.style.width = '100px';
    scrollDiv.style.height = '100px';
    scrollDiv.style.overflow = 'scroll';
    scrollDiv.style.position = 'absolute';
    scrollDiv.style.top = '-9999px';
    document.body.appendChild(scrollDiv);

    // Calcula a diferença entre offsetHeight e clientHeight
    const scrollbarHeight = scrollDiv.offsetHeight - scrollDiv.clientHeight;
    document.body.removeChild(scrollDiv);
    return scrollbarHeight;
  }

  onScrollIndexChange(event: any) {
    const container = document.querySelector(
      `#blockchain-container-${this.node.id}`
    ) as HTMLElement;
    this.calculateVirtualScrollHeight(container);
  }

  trackByHeight(index: number, height: Height): number {
    return height.n;
  }

  goToBlockDetails(block: any) {
    this.selectedBlock = block;
    this.calculateNavigationState(block);
    this.isDialogOpen = true;
  }

  private calculateNavigationState(block: Block) {
    // Encontra o bloco atual na estrutura de heights
    const currentHeightIndex = this.node.heights.findIndex(
      (h) => h.n === block.height
    );
    if (currentHeightIndex === -1) return;

    const currentHeight = this.node.heights[currentHeightIndex];
    const currentBlockIndex = currentHeight.blocks.findIndex(
      (b) => b.block.hash === block.hash
    );
    if (currentBlockIndex === -1) return;

    // Verifica se há bloco anterior
    this.hasPrevBlock = this.findPreviousBlock(block) !== null;

    // Verifica se há próximo bloco
    this.hasNextBlock = this.findNextBlock(block) !== null;
  }

  private findPreviousBlock(block: Block): Block | null {
    // Busca o bloco pai real via previousHash (nunca altura -1 fake)
    if (!block.previousHash || block.height <= 0) return null;
    for (const h of this.node.heights) {
      for (const bn of h.blocks) {
        if (bn.block.hash === block.previousHash && bn.block.height >= 0) {
          if (bn.block.height === -1) return null;
          return bn.block;
        }
      }
    }
    return null;
  }

  private findNextBlock(block: Block): Block | null {
    // Procura o próximo bloco na mesma chain
    const nextHeightIndex = this.node.heights.findIndex(
      (h) => h.n === block.height + 1
    );
    if (nextHeightIndex === -1) return null;

    const nextHeight = this.node.heights[nextHeightIndex];
    const nextBlock = nextHeight.blocks.find(
      (b) => b.block.previousHash === block.hash
    );
    return nextBlock?.block || null;
  }

  onDialogClose() {
    this.isDialogOpen = false;
    this.selectedBlock = null;
  }

  onGoPrevBlock() {
    if (this.selectedBlock) {
      const prevBlock = this.findPreviousBlock(this.selectedBlock);
      if (prevBlock) {
        this.selectedBlock = prevBlock;
        this.calculateNavigationState(prevBlock);
      }
    }
  }

  onGoNextBlock() {
    if (this.selectedBlock) {
      const nextBlock = this.findNextBlock(this.selectedBlock);
      if (nextBlock) {
        this.selectedBlock = nextBlock;
        this.calculateNavigationState(nextBlock);
      }
    }
  }

  ngOnDestroy() {
    // Remove listener para ESC
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.balancesSub?.unsubscribe();
  }
}
