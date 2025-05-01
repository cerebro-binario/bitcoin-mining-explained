import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
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
  private saveInterval?: any;

  constructor(
    public network: BitcoinNetworkService,
    private addressService: AddressService
  ) {}

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
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
    // Limpa os intervalos quando o componente é destruído
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  }
}
