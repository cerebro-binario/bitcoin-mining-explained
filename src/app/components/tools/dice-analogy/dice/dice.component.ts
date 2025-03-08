import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-dice',
  imports: [CommonModule],
  templateUrl: './dice.component.html',
  styleUrl: './dice.component.scss',
})
export class DiceComponent implements OnDestroy {
  private _value = 1;
  private _target = 6;

  private destroy$ = new Subject<void>();

  @Input() maxValue: number = 6;

  @Input()
  set dice(s: Subject<number>) {
    this.destroy$.next();
    s.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.rollDice(v);
    });
  }

  get value() {
    return this._value;
  }

  @Input()
  set target(v: number) {
    if (v === null) {
      return;
    }

    if (this._target !== v) {
      this._target = v;
    }
  }
  get target() {
    return this._target;
  }

  isRolling = false;
  success = false;

  // Posições das bolinhas (1 a 6)
  dotsPositions: { [i: number]: number[][] } = {
    1: [[1, 1]],
    2: [
      [0, 0],
      [2, 2],
    ],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    4: [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ],
    5: [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    6: [
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Verifica se há uma bolinha na posição específica do grid 3x3
   */
  hasDot(value: number, row: number, col: number): boolean {
    if (value > 6) return false;

    return (
      this.dotsPositions[value]?.some(
        (pos) => pos[0] === row && pos[1] === col
      ) ?? false
    );
  }

  rollDice(newValue: number) {
    if (newValue === null) {
      this.clearDice();
      return;
    }

    this.isRolling = true;
    this.success = false;
    const interval = setInterval(() => {
      this._value = Math.floor(Math.random() * this.maxValue) + 1;
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      this._value = newValue;
      this.checkSuccess();

      setTimeout(() => (this.isRolling = false), 100);
    }, 500); // Tempo da animação
  }

  private checkSuccess() {
    this.success = this._value <= this._target;
  }

  private clearDice() {
    this.success = false;
    this.isRolling = false;
    this._value = 1;
  }
}
