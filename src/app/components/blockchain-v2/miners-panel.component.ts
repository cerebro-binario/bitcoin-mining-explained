import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface Miner {
  name: string;
  hashRate: number;
  distance: number;
}

const MINERS_STORAGE_KEY = 'blockchain-v2-miners';

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent implements OnInit {
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

  onMinerChange() {
    this.saveMiners();
  }
}
