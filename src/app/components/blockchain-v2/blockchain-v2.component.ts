import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinersPanelComponent } from './miners-panel.component';
import { NodesPanelComponent } from './nodes-panel.component';

@Component({
  selector: 'app-blockchain-v2',
  standalone: true,
  imports: [CommonModule, MinersPanelComponent, NodesPanelComponent],
  templateUrl: './blockchain-v2.component.html',
  styleUrls: ['./blockchain-v2.component.scss'],
})
export class BlockchainV2Component {}
