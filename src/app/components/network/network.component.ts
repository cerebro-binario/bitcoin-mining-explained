import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { GraphPlotComponent } from './graph-plot/graph-plot.component';
import {
  MinersPanelComponent,
  MinersStats,
} from './miners-panel/miners-panel.component';
import { NodesPanelComponent } from './nodes-panel/nodes-panel.component';
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
export class NetworkComponent {
  private fadeTimeout: any;

  stats: MinersStats = {
    toCollapse: 0,
    toExpand: 0,
    allCollapsed: false,
    nTotal: 0,
    nMining: 0,
    nCanStart: 0,
    nCanPause: 0,
    defaultHashRate: 1000,
    totalHashRate: 0,
  };

  isControlPanelFaded = false;

  hashRateOptions = [
    { value: 1, label: '1 H/s' },
    { value: 100, label: '100 H/s' },
    { value: 1000, label: '1000 H/s' },
    { value: null, label: 'Máximo' },
  ];

  showSettings = false;

  @ViewChild(MinersPanelComponent) minersPanel!: MinersPanelComponent;

  constructor(public network: BitcoinNetworkService) {}

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

  onStatsChange(stats: MinersStats) {
    this.stats = stats;
  }
}
