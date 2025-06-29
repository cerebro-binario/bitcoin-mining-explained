import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Node } from '../../models/node';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { GraphPlotComponent } from './graph-plot/graph-plot.component';
import {
  MinersPanelComponent,
  MinersStats,
} from './miners-panel/miners-panel.component';
import { NodesPanelComponent } from './nodes-panel/nodes-panel.component';
import { UsersPanelComponent } from './users-panel/users-panel.component';
@Component({
  selector: 'app-network',
  standalone: true,
  imports: [
    CommonModule,
    MinersPanelComponent,
    NodesPanelComponent,
    GraphPlotComponent,
    UsersPanelComponent,
  ],
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss'],
})
export class NetworkComponent {
  private fadeTimeout: any;

  isControlPanelFaded = false;

  hashRateOptions = [
    { value: 1, label: '1 H/s' },
    { value: 1000, label: '1000 H/s' },
    { value: 10000, label: '10000 H/s' },
    { value: null, label: 'Máximo' },
  ];

  showSettings = false;

  @ViewChild(MinersPanelComponent) minersPanel!: MinersPanelComponent;

  nodes: Node[] = [];

  constructor(public network: BitcoinNetworkService) {
    this.network.nodes$.pipe(takeUntilDestroyed()).subscribe((nodes) => {
      this.nodes = nodes;
    });
  }

  ngAfterViewInit() {
    this.onControlPanelMouseLeave();
  }

  startAllMiners() {
    this.minersPanel.startAllMiners();
  }

  pauseAllMiners() {
    this.minersPanel.pauseAllMiners();
  }

  toggleAllMinersCollapse() {
    if (!this.minersPanel) return;
    this.minersPanel.setOrToggleAllMinersCollapsed();
  }

  setDefaultHashRate(value: number | null) {
    this.minersPanel.setDefaultHashRate(value);
  }

  onControlPanelMouseEnter() {
    this.isControlPanelFaded = false;
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
  }

  onControlPanelMouseLeave() {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }

    this.fadeTimeout = setTimeout(() => {
      this.isControlPanelFaded = true;
    }, 5000);
  }
}
