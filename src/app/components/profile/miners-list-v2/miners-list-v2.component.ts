import { Component } from '@angular/core';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';

@Component({
  selector: 'app-miners-list-v2',
  templateUrl: './miners-list-v2.component.html',
  styleUrls: ['./miners-list-v2.component.scss'],
})
export class MinersListV2Component {
  constructor(public bitcoinNetwork: BitcoinNetworkService) {}

  addMiner() {
    this.bitcoinNetwork.addNode('miner');
  }
}
