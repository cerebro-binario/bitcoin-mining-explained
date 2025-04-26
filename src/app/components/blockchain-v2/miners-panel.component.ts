import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BitcoinNode } from '../../models/bitcoin-node.model';

const MINERS_STORAGE_KEY = 'blockchain-v2-miners';

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent implements OnInit {
  miners: BitcoinNode[] = [];
  private minerCount = 1;

  ngOnInit() {
    const saved = localStorage.getItem(MINERS_STORAGE_KEY);
    if (saved) {
      this.miners = (JSON.parse(saved) as any[]).map(
        (obj) => new BitcoinNode(obj)
      );
      this.minerCount = this.miners.length + 1;
    }
  }

  addMiner() {
    this.miners.push(
      new BitcoinNode({
        id: this.minerCount,
        isMiner: true,
        name: `Minerador ${this.minerCount++}`,
        hashRate: 1000,
        distance: 50,
        neighbors: [],
      })
    );
    this.saveMiners();
  }

  saveMiners() {
    localStorage.setItem(MINERS_STORAGE_KEY, JSON.stringify(this.miners));
  }

  onMinerChange() {
    this.saveMiners();
  }
}
