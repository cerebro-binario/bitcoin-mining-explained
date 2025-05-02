import { CommonModule } from '@angular/common';
import { Component, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { Block } from '../../../models/block.model';
import { AddressService } from '../../../services/address.service';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { MinerComponent } from './miner/miner.component';

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [CommonModule, TooltipModule, MinerComponent],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent implements OnDestroy {
  private miningInterval?: any;
  private readonly MINING_INTERVAL = 1; // ms

  @ViewChildren('minerComponent') minerComponents!: QueryList<MinerComponent>;

  constructor(
    public network: BitcoinNetworkService,
    private addressService: AddressService
  ) {
    this.startMiningInterval();
  }

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  private startMiningInterval() {
    this.miningInterval = setInterval(() => {
      const now = Date.now();
      this.miners.forEach((miner) => {
        if (miner.isMining) {
          const minerComponent = this.getMinerComponent(miner.id);
          if (minerComponent) {
            minerComponent.processMiningTick(miner, now);
          }
        }
      });
    }, this.MINING_INTERVAL);
  }

  private getMinerComponent(
    minerId: number | undefined
  ): MinerComponent | null {
    if (minerId === undefined) return null;
    return this.minerComponents.find((c) => c.miner.id === minerId) || null;
  }

  addMiner() {
    const miner = this.network.addNode(true, undefined, 1000);
    miner.name = `Minerador ${miner.id}`;
    miner.miningAddress = this.addressService.generateRandomAddress();
    this.network.initializeNode(miner);
  }

  onBlockBroadcasted(event: { minerId: number; block: Block }) {
    this.network.propagateBlock(event.minerId, event.block);
  }

  onMinerRemoved(event: { minerId: number }) {
    this.network.removeNode(event.minerId);
  }

  ngOnDestroy() {
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
    }
  }
}
