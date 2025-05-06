import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Node } from '../../models/node';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import { GraphPlotComponent } from './graph-plot/graph-plot.component';
import { MinersPanelComponent } from './miners-panel/miners-panel.component';
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
  private _minersToExpandCount = 0;
  private _minersToCollapseCount = 0;

  miners$!: Observable<Node[]>;
  minersTotal = 0;
  minersMiningCount = 0;
  realNetworkHashRate = 0;
  minersToStartCount = 0;
  minersToPauseCount = 0;

  isControlPanelFaded = false;
  allMinersCollapsed = false;
  defaultHashRate: number | null = 1000;

  hashRateOptions = [
    { value: 1, label: '1 H/s' },
    { value: 100, label: '100 H/s' },
    { value: 1000, label: '1000 H/s' },
    { value: null, label: 'Máximo' },
  ];

  showSettings = false;

  @ViewChild(MinersPanelComponent) minersPanel!: MinersPanelComponent;

  constructor(public network: BitcoinNetworkService) {
    this.miners$ = this.network.nodes$.pipe(
      map((nodes) => nodes.filter((n) => n.isMiner)),
      tap((miners) => {
        this.minersTotal = miners.length;

        const minersMining = miners.filter((m) => m.isMining);

        this.minersMiningCount = minersMining.length;
        this.realNetworkHashRate = minersMining.reduce(
          (sum, m) => sum + m.currentHashRate,
          0
        );
        this.minersToPauseCount = minersMining.length;

        this.minersToStartCount = miners.filter(
          (m) => !m.isMining && (!m.isSyncing || m.initialSyncComplete)
        ).length;
      })
    );
  }

  ngAfterViewInit() {
    this.onControlPanelMouseLeave();
  }

  set minersToExpandCount(value: number) {
    this._minersToExpandCount = value;
  }
  get minersToExpandCount() {
    return this._minersToExpandCount;
  }

  set minersToCollapseCount(value: number) {
    this._minersToCollapseCount = value;
  }
  get minersToCollapseCount() {
    return this._minersToCollapseCount;
  }

  startAllMiners() {
    this.minersPanel.startAllMiners();
  }

  pauseAllMiners() {
    this.minersPanel.pauseAllMiners();
  }

  toggleAllMinersCollapse() {
    if (!this.minersPanel) return;
    this.minersPanel.toggleAllMinersCollapse();
  }

  setDefaultHashRate(value: number | null) {
    this.defaultHashRate = value;
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
