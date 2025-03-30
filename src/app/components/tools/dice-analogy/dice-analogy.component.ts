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
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { interval, startWith, Subject, Subscription, takeWhile } from 'rxjs';
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
  timestamp: number;
  miningTime: number;
}

interface Chain {
  heights: BlockWinner[][];
}

@Component({
  selector: 'app-dice-analogy',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    DiceComponent,
    CheckboxModule,
    TooltipModule,
    InputNumberModule,
    DialogModule,
    SelectButtonModule,
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
    trigger('difficultyChange', [
      transition(':increment', [
        style({ color: '#10b981', transform: 'scale(1.2)' }),
        animate('300ms ease-out', style({ color: '*', transform: 'scale(1)' })),
      ]),
      transition(':decrement', [
        style({ color: '#ef4444', transform: 'scale(1.2)' }),
        animate('300ms ease-out', style({ color: '*', transform: 'scale(1)' })),
      ]),
    ]),
  ],
})
export class DiceAnalogyComponent {
  Math = Math;
  totalDices: number = 0;
  totalCompetitors: number = 0;
  hitProbabilityVariation: { value: number; increased: boolean | null } = {
    value: 0,
    increased: null,
  };
  averageThrowsToHit: number = 1;
  averageTimeToHit: number = 0;

  // Quando o dialog for aberto, reseta os params de edição
  set isEditing(value: boolean) {
    if (value === true) {
      this.resetEditingParams();
    }
    this._isEditing = value;
  }
  get isEditing(): boolean {
    return this._isEditing;
  }
  private _isEditing = false;

  maxTarget: number = 6;
  target: number = this.maxTarget;
  private previousTarget: number = this.target;
  private previousMaxTarget: number = this.maxTarget;
  hitProbability: string = '';
  nBlocksToAdjust: number = 10;
  miningTimeSeconds: number = 10;
  realMiningTimeSeconds!: number;

  competitors: Competitor[] = [];
  private nextCompetitorId: number = 1;
  miningInterval: number = 1;
  autoPauseMode: 'none' | 'block' | 'adjustment' = 'none';
  autoPauseModeOptions = [
    { label: 'Não', value: 'none' },
    { label: 'Bloco', value: 'block' },
    { label: 'Reajuste', value: 'adjustment' },
  ];
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

  get rollAnimationDuration() {
    return Math.min((this.miningInterval * 1000) / 2, 600);
  }

  private miningStartTime: number = 0;
  private timerSubscription: any;
  currentMiningTime: number = 0;
  private pausedCurrentMiningTime: number = 0;

  // Variáveis temporárias para edição
  editingParams = {
    target: 1,
    maxTarget: 6,
    nBlocksToAdjust: 10,
    miningTimeSeconds: 10,
    miningInterval: 1,
    autoPauseMode: 'none' as 'none' | 'block' | 'adjustment',
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

    this.calcHitProbability();
    this.calcHitProbabilityVariation();
    this.resetEditingParams();
    this.updateStats();
  }

  private resetEditingParams() {
    this.editingParams = {
      target: this.target,
      maxTarget: this.maxTarget,
      nBlocksToAdjust: this.nBlocksToAdjust,
      miningTimeSeconds: this.miningTimeSeconds,
      miningInterval: this.miningInterval,
      autoPauseMode: this.autoPauseMode,
    };
  }

  saveParameters() {
    // Calcula a variação antes de atualizar os parâmetros
    const currentProb =
      this.editingParams.target / this.editingParams.maxTarget;
    const previousProb = this.previousTarget / this.previousMaxTarget;
    const variation = ((currentProb - previousProb) / previousProb) * 100;
    this.hitProbabilityVariation = {
      value: Math.abs(variation),
      increased: variation > 0,
    };

    this.target = this.editingParams.target;
    this.maxTarget = this.editingParams.maxTarget;
    this.previousTarget = this.target;
    this.previousMaxTarget = this.maxTarget;
    this.nBlocksToAdjust = this.editingParams.nBlocksToAdjust;
    this.miningTimeSeconds = this.editingParams.miningTimeSeconds;
    this.miningInterval = this.editingParams.miningInterval;
    this.autoPauseMode = this.editingParams.autoPauseMode;
    this.isEditing = false;
  }

  cancelEditing() {
    this.resetEditingParams();
    this.isEditing = false;
  }

  private updateStats() {
    this.totalDices = this.competitors.reduce(
      (sum, comp) => sum + comp.diceCount,
      0
    );
    this.totalCompetitors = this.competitors.length;
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
    this.updateStats();
  }

  // Incrementa a quantidade de dados e adiciona um novo elemento no array de resultados
  increaseDice(competitor: Competitor) {
    competitor.diceCount++;
    competitor.dices.push(new Subject());
    this.updateStats();
  }

  // Decrementa a quantidade de dados, garantindo que fique pelo menos 1
  decreaseDice(competitor: Competitor) {
    if (competitor.diceCount > 1) {
      competitor.diceCount--;
      competitor.dices.pop();
      this.updateStats();
    }
  }

  // Remove um competidor
  removeCompetitor(id: number) {
    this.competitors = this.competitors.filter((c) => c.id !== id);
    this.updateStats();
  }

  // Função para gerar um número aleatório entre 1 e 6
  rollDice(): number {
    return Math.floor(Math.random() * this.maxTarget) + 1;
  }

  playCompetition(rounds?: number) {
    this.miningStartTime = Date.now() - this.pausedCurrentMiningTime;

    this.isMining = true;

    // Usamos o timer do RxJS para atualizar o tempo a cada 100ms, independente do intervalo de mineração
    this.timerSubscription = interval(100)
      .pipe(
        startWith(0),
        takeWhile(() => this.isMining && (rounds === undefined || rounds > 0))
      )
      .subscribe(() => {
        this.currentMiningTime = Date.now() - this.miningStartTime;
      });

    this.miningSubscription = interval(this.miningInterval * 1000)
      .pipe(
        startWith(0),
        takeWhile(() => this.isMining && (rounds === undefined || rounds > 0))
      )
      .subscribe(() => {
        this.simulateMining();
        if (rounds !== undefined) {
          rounds--;
          if (rounds === 0) {
            this.pauseCompetition();
          }
        }
      });
  }

  pauseCompetition() {
    this.isMining = false;
    this.pausedCurrentMiningTime = this.currentMiningTime;
    this.miningSubscription?.unsubscribe();
    this.timerSubscription?.unsubscribe();
  }

  toggleCompetition() {
    this.isMining ? this.pauseCompetition() : this.playCompetition();
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

    if (roundWinners.length > 0) {
      this.addNewBlocks(roundWinners);
      if (this.shouldAutoPause()) {
        this.pauseCompetition();
      }
    }
  }

  addNewBlocks(winners: Competitor[]) {
    const height = this.chain.heights.length;
    const newBlocks: BlockWinner[] = winners.map((w) => ({
      winner: w,
      next: [],
      isDeadFork: false,
      timestamp: Date.now(),
      miningTime: this.currentMiningTime,
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

      this.adjustDifficulty();
      this.updateMiningStats();
    }, this.rollAnimationDuration);
  }

  getAutoPauseModeLabel(): string {
    const option = this.autoPauseModeOptions.find(
      (opt) => opt.value === this.autoPauseMode
    );
    return option?.label || 'Não';
  }

  private updateMiningStats() {
    this.calcMiningTime();
    this.calcHitProbability();
    this.calcHitProbabilityVariation();
  }

  private calcMiningTime() {
    // Reinicia o cronômetro para o próximo bloco
    this.miningStartTime = Date.now();
    this.currentMiningTime = 0;
    this.pausedCurrentMiningTime = 0;

    const epochLast = 0;
    const epochFirst = (this.chain.heights.length - 1) % this.nBlocksToAdjust;
    const nBlocks = epochFirst + 1;

    let totalTime = 0;
    for (let i = epochLast; i <= epochFirst; i++) {
      totalTime += this.chain.heights[i][0].miningTime;
    }

    this.realMiningTimeSeconds = totalTime / nBlocks / 1000;
  }

  adjustDifficulty() {
    const height = this.chain.heights.length;

    if (height === 0 || height % this.nBlocksToAdjust !== 0) {
      return;
    }

    const last = this.chain.heights[0];
    const first = this.chain.heights[this.nBlocksToAdjust - 1];

    const timeDiff = last[0].timestamp - first[0].timestamp;

    let adjustRate =
      timeDiff / (this.nBlocksToAdjust * this.miningTimeSeconds * 1000);

    adjustRate = Math.min(4, adjustRate);
    adjustRate = Math.max(0.25, adjustRate);

    this.previousTarget = this.target;
    let newTarget = Math.max(this.target * adjustRate, 1);
    newTarget = Math.min(newTarget, this.maxTarget);

    this.target = newTarget;
  }

  calcHitProbability() {
    this.hitProbability = ((this.target / this.maxTarget) * 100).toFixed(1);
    // Calcula o número médio de lançamentos necessários, arredondando para o próximo inteiro
    this.averageThrowsToHit = Math.ceil(this.maxTarget / this.target);
    // Calcula o tempo médio esperado para acertar
    // Considerando que cada dado lança a cada miningInterval segundos
    // e temos totalDices dados lançando simultaneamente
    const throwsPerSecond = this.totalDices / this.miningInterval;
    this.averageTimeToHit = this.averageThrowsToHit / throwsPerSecond;
  }

  calcHitProbabilityVariation() {
    if (this.previousTarget === this.target) {
      this.hitProbabilityVariation = { value: 0, increased: null };
      return;
    }

    const currentProb = this.target / this.maxTarget;
    const previousProb = this.previousTarget / this.previousMaxTarget;
    const variation = ((previousProb - currentProb) / previousProb) * 100;
    this.hitProbabilityVariation = {
      value: Math.abs(variation),
      increased: variation > 0,
    };
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
    const midX = (startX + endX) / 2; // Ponto no meio do caminho horizontalmente

    // **AUMENTAMOS** a distância dos pontos de controle para criar uma curva mais acentuada
    const controlX1 = startX + (midX - startX) * 1.15; // Puxa mais a curva na 1ª metade
    const controlX2 = endX + (midX - endX) * 1.15; // Puxa mais a curva na 2ª metade

    const controlY1 = startY;
    const controlY2 = endY;

    return `M ${startX},${startY} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${endX},${endY}`;
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

  getConnectionStrokeColor(block: BlockWinner, isResolved: boolean): string {
    if (block.isDeadFork) return '#ef4444'; // bg-red-500
    if (isResolved) return '#22c55e'; // bg-green-500
    return '#3b82f6'; // bg-blue-500
  }

  // Método para contar quantos blocos vieram depois deste (profundidade)
  getConfirmations(block: BlockWinner): number {
    let confirmations = 0;
    let currentBlock = block;

    while (currentBlock.next.length > 0) {
      confirmations++;
      currentBlock = currentBlock.next[0]; // Segue pela cadeia principal
    }

    return confirmations;
  }

  // Retorna o ícone correto baseado na profundidade do bloco
  getBlockStatusIcon(
    height: number
  ): { icon: string; color: string; tooltip: string } | null {
    const confirmations =
      this.chain.heights.length - (this.chain.heights.length - height);

    if (confirmations < 6) {
      return {
        icon: 'pi pi-exclamation-triangle',
        color: 'text-yellow-400',
        tooltip: 'Bloco ainda não está seguro. Aguarde mais confirmações.',
      }; // 🔶 Alerta
    }

    if (confirmations >= 6 && confirmations < 10) {
      return {
        icon: 'pi pi-check',
        color: 'text-white',
        tooltip:
          'Bloco razoavelmente seguro. Idealmente, aguarde mais algumas confirmações.',
      }; // ✅ Check Azul
    }

    if (confirmations >= 10) {
      return {
        icon: 'pi pi-verified',
        color: 'text-white',
        tooltip: 'Bloco altamente seguro. Transação praticamente irreversível.',
      }; // ✅✅ Check Duplo Azul
    }

    return null; // Sem ícone
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

  private shouldAutoPause(): boolean {
    switch (this.autoPauseMode) {
      case 'block':
        return true;
      case 'adjustment':
        const height = this.chain.heights.length + 1;
        return height % this.nBlocksToAdjust === 0 && height > 1;
      default:
        return false;
    }
  }

  formatMiningTime(ms: number): string {
    return `${(ms / 1000).toFixed(3)}s`;
  }

  getCurrentEpoch(): number {
    return Math.floor(this.chain.heights.length / this.nBlocksToAdjust) + 1;
  }

  formatOrdinal(n: number): string {
    return n + 'ª';
  }

  getThrowsMessage(): string {
    return `Média de ${this.averageThrowsToHit} lançamento${
      this.averageThrowsToHit > 1 ? 's' : ''
    } para acertar`;
  }
}
