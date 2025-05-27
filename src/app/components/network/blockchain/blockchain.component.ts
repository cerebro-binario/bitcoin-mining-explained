import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BlockNode } from '../../../models/block.model';
import { Node } from '../../../models/node';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  imports: [CommonModule],
  animations: [
    trigger('blockAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.5s ease-out', style({ opacity: 1 })),
      ]),
    ]),
    trigger('slideRightAnimation', [
      state('default', style({ transform: 'translateX(0)' })),
      state('moved', style({ transform: '{{slideXValue}}' }), {
        params: { slideXValue: 'translateX(100%)' },
      }),
      transition('default => moved', [animate('0.5s ease-out')]),
      transition('moved => default', [animate('0s ease-out')]),
    ]),
  ],
})
export class BlockchainComponent {
  @Input() miner!: Node;
  @Input() slideXValue = 'translateX(100%)';

  // Propriedades para o cálculo de gaps
  private hasCalculatedGaps = false;
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

  // Método chamado após a view ser inicializada
  ngAfterViewInit() {
    // Verifica se existe algum bloco minerado
    const hasBlocks = this.miner.heights.length > 1;
    if (hasBlocks) {
      requestAnimationFrame(() => {
        this.calculateGaps();
      });
    }
  }

  // Método para calcular os gaps
  calculateGaps() {
    const container = document.querySelector(
      '#miners-panel-container'
    ) as HTMLElement;
    if (!container) return;

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
      this.slideXValue = `translateX(calc(${this.connectorViewbox.w}px + ${this.gap.x.value}px))`;
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
    if (!this.hasCalculatedGaps) {
      this.calculateGaps();
      this.hasCalculatedGaps = true;
    }

    const parent = node.parent;
    if (!parent) return '';

    let hTotal = parent.children.length;
    let h = parent.children.findIndex((c) => c.block.hash === node.block.hash);

    const prevPosition = miner.heights[height + 1]?.findIndex(
      (b) => b.block.hash === parent.block.hash
    );
    const currPosition = miner.heights[height]?.findIndex(
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
    if (isResolved) return '#4b5563'; // cinza neutro para main chain
    if (!node.isActive) return '#6b7280'; // cinza mais claro para dead forks
    return '#4b5563'; // cinza neutro para conexões em andamento
  }

  // Calcula o valor dinâmico para o topo da conexão
  getDynamicTopValue(total: number, index: number): number {
    return (100 / (total + 1)) * (index + 1);
  }

  // Verifica se a altura está resolvida (todos os blocos da altura estão na main chain)
  isHeightResolved(height: number): boolean {
    const blocks = this.miner.heights[height];
    const activeBlocks = blocks.filter((b) => b.isActive).length; // Conta apenas blocos ativos
    return activeBlocks === 1;
  }

  getOriginBlockTransform(childrenLength: number): string {
    const originBlock = document.querySelector(
      `#originBlock-${this.miner.id}`
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
}
