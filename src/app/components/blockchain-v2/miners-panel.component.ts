import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent {
  constructor(public network: BitcoinNetworkService) {}

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  addMiner() {
    const node = this.network.addNode(true, undefined, 1000);
    node.name = `Minerador ${node.id}`;
    this.network.save();
  }

  removeMiner(index: number) {
    const miner = this.miners[index];
    if (miner) {
      this.network.removeNode(miner.id!);
    }
  }

  onMinerChange() {
    this.network.save();
  }
}
