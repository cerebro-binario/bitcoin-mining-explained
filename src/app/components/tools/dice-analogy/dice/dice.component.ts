import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-dice',
  imports: [CommonModule],
  templateUrl: './dice.component.html',
  styleUrl: './dice.component.scss',
})
export class DiceComponent {
  @Input() value: number = 1; // Valor padrão do dado

  isRolling = false;

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

  /**
   * Verifica se há uma bolinha na posição específica do grid 3x3
   */
  hasDot(value: number, row: number, col: number): boolean {
    console.log('test');
    return (
      this.dotsPositions[value]?.some(
        (pos) => pos[0] === row && pos[1] === col
      ) ?? false
    );
  }

  rollDice(newValue: number) {
    this.isRolling = true;
    setTimeout(() => {
      this.value = newValue;
      this.isRolling = false;
    }, 500); // Tempo da animação
  }
}
