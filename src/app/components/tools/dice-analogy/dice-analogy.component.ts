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

interface Block {
  winner: Competitor;
  previous?: Block;
  next: Block[];
}

interface Chain {
  heights: Block[][];
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
      state('moved', style({ transform: 'translateX(calc(100% + 40px))' })),
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

  chain: Chain = { heights: [] };

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
    const newBlocks: Block[] = winners.map((w) => ({
      winner: w,
      next: [],
    }));

    this.isMoving = true;

    setTimeout(() => {
      this.chain.heights.unshift(newBlocks);
      this.isMoving = false;

      // Resolver possíveis forks
      if (height > 0) {
        const lastBlocks = this.chain.heights[1];
        newBlocks.forEach((block) => {
          const closest = this.determineClosest(lastBlocks, block);

          block.previous = closest;
          closest.next.push(block);
        });
      }
    }, 750);
  }

  determineClosest(lastBlocks: Block[], block: Block): Block {
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
}
