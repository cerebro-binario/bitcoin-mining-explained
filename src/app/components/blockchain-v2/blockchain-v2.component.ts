import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinersPanelComponent } from './miners-panel/miners-panel.component';
import { NodesPanelComponent } from './nodes-panel/nodes-panel.component';
import { GraphPlotComponent } from './graph-plot/graph-plot.component';

@Component({
  selector: 'app-blockchain-v2',
  standalone: true,
  imports: [
    CommonModule,
    MinersPanelComponent,
    NodesPanelComponent,
    GraphPlotComponent,
  ],
  templateUrl: './blockchain-v2.component.html',
  styleUrls: ['./blockchain-v2.component.scss'],
})
export class BlockchainV2Component {}
