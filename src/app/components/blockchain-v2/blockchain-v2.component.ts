import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Miner {
  name: string;
  hashRate: number;
  distance: number;
}

@Component({
  selector: 'app-blockchain-v2',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './blockchain-v2.component.html',
  styleUrls: ['./blockchain-v2.component.scss'],
})
export class BlockchainV2Component {
  miners: Miner[] = [];
  private minerCount = 1;

  addMiner() {
    this.miners.push({
      name: `Minerador ${this.minerCount++}`,
      hashRate: 1000,
      distance: 50,
    });
  }
}
