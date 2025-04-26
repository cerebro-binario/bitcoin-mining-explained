import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Miner {
  name: string;
  hashRate: number;
  distance: number;
}

const MINERS_STORAGE_KEY = 'blockchain-v2-miners';

@Component({
  selector: 'app-blockchain-v2',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './blockchain-v2.component.html',
  styleUrls: ['./blockchain-v2.component.scss'],
})
export class BlockchainV2Component implements OnInit {
  miners: Miner[] = [];
  private minerCount = 1;

  ngOnInit() {
    const saved = localStorage.getItem(MINERS_STORAGE_KEY);
    if (saved) {
      this.miners = JSON.parse(saved);
      this.minerCount = this.miners.length + 1;
    }
  }

  addMiner() {
    this.miners.push({
      name: `Minerador ${this.minerCount++}`,
      hashRate: 1000,
      distance: 50,
    });
    this.saveMiners();
  }

  saveMiners() {
    localStorage.setItem(MINERS_STORAGE_KEY, JSON.stringify(this.miners));
  }

  // Salvar ao editar hashRate ou distance
  onMinerChange() {
    this.saveMiners();
  }
}
