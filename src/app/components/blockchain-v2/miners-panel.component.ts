import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { MiningBlockComponent } from './mining-block/mining-block.component';
import { BitcoinNode } from '../../models/bitcoin-node.model';
import { BlockchainService } from '../../services/blockchain.service';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [FormsModule, CommonModule, MiningBlockComponent],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent {
  hashRateOptions: HashRateOption[] = [
    { label: '1 H/s', value: 1 },
    { label: '100 H/s', value: 100 },
    { label: '1000 H/s', value: 1000 },
    { label: 'Máximo', value: null },
  ];

  constructor(
    public network: BitcoinNetworkService,
    private blockchain: BlockchainService
  ) {}

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

  setHashRate(miner: BitcoinNode, rate: number | null) {
    miner.hashRate = rate;
    if (miner.isMining) {
      this.stopMining(miner);
      this.startMining(miner);
    }
    this.network.save();
  }

  startMining(miner: BitcoinNode) {
    if (miner.isMining) return;

    // Cria um novo bloco se não houver um atual
    if (!miner.currentBlock) {
      miner.currentBlock = this.blockchain.createNewBlock(miner);
    }

    miner.isMining = true;
    const hashRate = miner.hashRate || 1000;

    if (hashRate === null) {
      // Modo máximo - sem intervalo
      miner.miningInterval = setInterval(() => {
        if (!miner.currentBlock) return;

        // Incrementa o nonce e calcula o hash
        miner.currentBlock.nonce++;
        miner.currentBlock.hash = this.blockchain.calculateBlockHash(
          miner.currentBlock
        );

        // Verifica se encontrou um hash válido
        if (this.blockchain.isValidBlock(miner.currentBlock)) {
          // TODO: Propagar o bloco para a rede
          console.log('Bloco minerado!', miner.currentBlock);

          // Cria um novo bloco para continuar minerando
          miner.currentBlock = this.blockchain.createNewBlock(
            miner,
            miner.currentBlock
          );
        }
      }, 0);
    } else {
      // Modo com intervalo controlado
      miner.miningInterval = setInterval(() => {
        if (!miner.currentBlock) return;

        // Incrementa o nonce e calcula o hash
        miner.currentBlock.nonce++;
        miner.currentBlock.hash = this.blockchain.calculateBlockHash(
          miner.currentBlock
        );

        // Verifica se encontrou um hash válido
        if (this.blockchain.isValidBlock(miner.currentBlock)) {
          // TODO: Propagar o bloco para a rede
          console.log('Bloco minerado!', miner.currentBlock);

          // Cria um novo bloco para continuar minerando
          miner.currentBlock = this.blockchain.createNewBlock(
            miner,
            miner.currentBlock
          );
        }
      }, 1000 / hashRate);
    }

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
