import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinersPanelComponent } from './miners-panel/miners-panel.component';
import { NodesPanelComponent } from './nodes-panel/nodes-panel.component';
import { GraphPlotComponent } from './graph-plot/graph-plot.component';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [
    CommonModule,
    MinersPanelComponent,
    NodesPanelComponent,
    GraphPlotComponent,
  ],
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss'],
})
export class NetworkComponent {}
