import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { KnobModule } from 'primeng/knob';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { interval, Subject, Subscription, takeWhile } from 'rxjs';
import { DiceComponent } from './dice/dice.component';

interface Competitor {
  id: number;
  name: string;
  diceCount: number;
  dices: Subject<number>[];
}

export interface BlockWinner {
  winner: Competitor;
  previous?: BlockWinner;
  next: BlockWinner[];
  isDeadFork: boolean;
}

interface Chain {
  heights: BlockWinner[][];
}

@Component({
  selector: 'app-dice-analogy',
  imports: [
    CommonModule,
    FormsModule,
    KnobModule,
    CardModule,
    ButtonModule,
    TableModule,
    DiceComponent,
    TagModule,
    CheckboxModule,
  ],
  templateUrl: './dice-analogy.component.html',
  styleUrl: './dice-analogy.component.scss',
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
export class DiceAnalogyComponent {
  target: number = 1;

  competitors: Competitor[] = [];
  private nextCompetitorId: number = 1;
  miningInterval: number = 1000;
  autoPause: boolean = true;
  isMining: boolean = false;
  private miningSubscription: Subscription | null = null;
  isMoving = false;
  slideXValue = 'translateX(100%)';
  connectorViewbox = { w: 100, h: 100 };

  chain: Chain = { heights: [] };

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

  ngOnInit() {
    let i;
    for (i = 0; i < 3; i++) {
      this.addCompetitor();
    }

    this.competitors.forEach((c) => {
      this.increaseDice(c);
      this.increaseDice(c);
      this.increaseDice(c);
    });
  }

  // Adiciona um novo competidor (inicia com 1 dado e resultado null)
  addCompetitor() {
    const newCompetitor: Competitor = {
      id: this.nextCompetitorId,
      name: `Competidor ${this.nextCompetitorId}`,
      diceCount: 1,
      dices: [new Subject()],
    };
    this.competitors.push(newCompetitor);
    this.nextCompetitorId++;
  }

  // Incrementa a quantidade de dados e adiciona um novo elemento no array de resultados
  increaseDice(competitor: Competitor) {
    competitor.diceCount++;
    competitor.dices.push(new Subject());
  }

  // Decrementa a quantidade de dados, garantindo que fique pelo menos 1
  decreaseDice(competitor: Competitor) {
    if (competitor.diceCount > 1) {
      competitor.diceCount--;
      competitor.dices.pop();
    }
  }

  // Remove um competidor
  removeCompetitor(id: number) {
    this.competitors = this.competitors.filter((c) => c.id !== id);
  }

  // Função para gerar um número aleatório entre 1 e 6
  rollDice(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  startCompetition() {
    this.isMining = true;
    this.miningSubscription = interval(this.miningInterval)
      .pipe(takeWhile(() => this.isMining))
      .subscribe(() => this.simulateMining());
  }

  stopCompetition() {
    this.isMining = false;
    this.miningSubscription?.unsubscribe();
  }

  toggleCompetition() {
    this.isMining ? this.stopCompetition() : this.startCompetition();
  }

  simulateMining() {
    let roundWinners: Competitor[] = [];

    this.competitors.forEach((competitor) => {
      competitor.dices.forEach((dice) => {
        const result = this.rollDice();
        dice.next(result);
        if (result <= this.target && !roundWinners.includes(competitor)) {
          roundWinners.push(competitor);
        }
      });
    });

    // esperar animação do dado terminar
    setTimeout(() => {
      if (roundWinners.length > 0) {
        this.resolveForks(roundWinners);
        if (this.autoPause) {
          this.stopCompetition();
        }
      }
    }, 500);
  }

  resolveForks(winners: Competitor[]) {
    const height = this.chain.heights.length;
    const newBlocks: BlockWinner[] = winners.map((w) => ({
      winner: w,
      next: [],
      isDeadFork: false,
    }));

    this.isMoving = true;

    setTimeout(() => {
      this.isMoving = false;

      // Resolver possíveis forks
      if (height > 0) {
        const lastBlocks = this.chain.heights[0];
        newBlocks.forEach((block) => {
          const closest = this.determineClosest(lastBlocks, block);

          block.previous = closest;
          closest.next.push(block);
        });

        this.reorderChainBeforeAddingNewBlocks();

        this.chain.heights.unshift(newBlocks);
      } else {
        this.chain.heights.unshift(newBlocks);
        requestAnimationFrame(() => {
          this.calculateGaps();
        });
      }
    }, 750);
  }

  determineClosest(lastBlocks: BlockWinner[], block: BlockWinner): BlockWinner {
    return (
      lastBlocks.find((b) => b === block) ||
      lastBlocks.reduce((result, current, i) => {
        if (i === 0) {
          return current;
        }

        const resultDiff = block.winner.id - result.winner.id;
        const resultDiffAbs = Math.abs(resultDiff);
        const currentDiff = block.winner.id - current.winner.id;
        const currentDiffAbs = Math.abs(currentDiff);

        if (currentDiffAbs < resultDiffAbs) {
          return current;
        }

        if (currentDiffAbs > resultDiffAbs) {
          return result;
        }

        if (currentDiff < resultDiff) {
          return current;
        }

        return result;
      }, lastBlocks[0])
    );
  }

  // Converte o `top` de string para número para posicionar o `path`
  getDynamicTopValue(total: number, index: number): number {
    return (100 / (total + 1)) * (index + 1);
  }

  getCurvedPath(block: BlockWinner, index: number): string {
    const prev = block.previous as BlockWinner;
    const hTotal = prev.next.length;
    const h = prev.next.findIndex((b) => b.winner === block.winner);
    const prevPosition = this.chain.heights[index + 1].findIndex(
      (b) => b.winner === prev.winner
    );
    const currPosition = this.chain.heights[index].findIndex(
      (b) => b.winner === block.winner
    );

    const startX = this.connectorViewbox.w;
    const startY = this.connectorViewbox.h / 2;

    // Calcula a posição final do bloco filho
    const endX = this.connectorViewbox.w + this.gap.x.value;
    const endY =
      (this.getDynamicTopValue(hTotal, h) / 100) * this.connectorViewbox.h +
      (this.connectorViewbox.h + this.gap.y.value) *
        (prevPosition - currPosition);

    // Ponto de controle para a curva
    const controlX = (startX + endX) / 2; // Ponto médio na horizontal
    const controlY = startY + (endY - startY) / 2; // Ponto médio na vertical

    return `M ${startX},${startY} C ${controlX},${controlY} ${controlX},${controlY} ${endX},${endY}`;
  }

  trackBlocksByFn(index: number, item: BlockWinner) {
    return item.winner.id;
  }

  private calculateGaps() {
    // Calcular gap horizontal
    const blockchainContainer = document.querySelector(
      '#blockchain'
    ) as HTMLElement;

    const blockchainContainerComputedStyle =
      window.getComputedStyle(blockchainContainer);

    this.gap.x.value =
      parseFloat(blockchainContainerComputedStyle.getPropertyValue('gap')) || 0;

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

    this.slideXValue = `translateX(calc(100% + ${this.gap.x.value}px))`;

    this.connectorViewbox = { w: blockWidth, h: blockHeight };
  }

  // Método para reordenar a cadeia e marcar forks mortos antes de adicionar novos blocos
  reorderChainBeforeAddingNewBlocks() {
    if (this.chain.heights.length === 0) return;

    const heightsToReorder = new Set<number>(); // Guarda os heights que precisam ser reordenados

    // Passo 1: Identificar forks mortos e registrar os heights afetados
    for (let h = 0; h < this.chain.heights.length; h++) {
      this.chain.heights[h].forEach((block) => {
        if (block.next.length === 0) {
          this.markAsDeadFork(block, heightsToReorder, h);
        }
      });
    }

    // Passo 2: Reordenar todos os heights afetados
    heightsToReorder.forEach((height) => {
      this.chain.heights[height] = this.chain.heights[height].sort(
        this.sortBlocks
      );
    });

    // Passo 3: Reordenar também os arrays `next[]` dentro de cada bloco
    this.chain.heights.forEach((blocks) => {
      blocks.forEach((block) => {
        block.next.sort(this.sortBlocks);
      });
    });
  }

  isHeightResolved(height: number): boolean {
    const blocks = this.chain.heights[height];
    const activeBlocks = blocks.filter((b) => !b.isDeadFork).length; // Conta apenas blocos ativos
    return activeBlocks === 1;
  }

  // Método para marcar um fork morto recursivamente
  private markAsDeadFork(
    block: BlockWinner,
    heightsToReorder: Set<number>,
    height: number
  ) {
    if (block.isDeadFork) return; // Se já foi marcado, evita loops infinitos

    if (block.next.some((b) => !b.isDeadFork)) return; // Se possui um sucessor não morto

    block.isDeadFork = true; // Marca como fork morto
    heightsToReorder.add(height); // Adiciona este height à lista de reordenação

    // Recursivamente marca os blocos anteriores
    if (block.previous) {
      // Encontrar em qual height o bloco anterior está para reordenar essa camada também
      const previousHeight = this.findBlockHeight(block.previous);
      if (previousHeight !== -1) {
        this.markAsDeadFork(block.previous, heightsToReorder, previousHeight);
      }
    }
  }

  // Método para ordenar os blocos, movendo forks mortos para o final
  private sortBlocks(a: BlockWinner, b: BlockWinner): number {
    // Prioriza blocos **ativos** (não mortos)
    if (a.isDeadFork && !b.isDeadFork) return 1;
    if (!a.isDeadFork && b.isDeadFork) return -1;

    // Caso ambos sejam ativos ou ambos sejam forks, ordena por ID do minerador
    return a.winner.id - b.winner.id;
  }

  // Método para encontrar em qual height um bloco específico está
  private findBlockHeight(block: BlockWinner): number {
    for (let h = 0; h < this.chain.heights.length; h++) {
      if (this.chain.heights[h].includes(block)) {
        return h;
      }
    }
    return -1; // Retorna -1 se não encontrar (caso improvável)
  }
}
