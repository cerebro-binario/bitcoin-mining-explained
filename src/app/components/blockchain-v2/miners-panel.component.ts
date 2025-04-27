import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { MiningBlockComponent } from './mining-block/mining-block.component';
import { BitcoinNode } from '../../models/bitcoin-node.model';

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [FormsModule, CommonModule, MiningBlockComponent],
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
      this.stopMining(miner);
      this.network.removeNode(miner.id!);
    }
  }

  startMining(miner: BitcoinNode) {
    if (miner.isMining) return;

    miner.isMining = true;
    const hashRate = miner.hashRate || 1000;

    miner.miningInterval = setInterval(() => {
      if (!miner.currentBlock) return;

      // Incrementa o nonce
      miner.currentBlock.nonce++;

      // TODO: Verificar se encontrou o hash válido
      // Se encontrou, propagar o bloco para a rede
    }, 1000 / hashRate);

    this.network.save();
  }

  stopMining(miner: BitcoinNode) {
    if (!miner.isMining) return;

    miner.isMining = false;
    if (miner.miningInterval) {
      clearInterval(miner.miningInterval);
      miner.miningInterval = undefined;
    }

    this.network.save();
  }

  onMinerChange() {
    this.network.save();
  }
}
