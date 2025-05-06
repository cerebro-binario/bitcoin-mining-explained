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

  miners$!: Observable<Node[]>;
  minersTotal = 0;
  minersMiningCount = 0;
  minersToExpandCount = 0;
  minersToCollapseCount = 0;
  minersToStartCount = 0;
  minersToPauseCount = 0;
  realNetworkHashRate = 0;

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
        this.updateMinersStats(miners);
      })
    );
  }

  ngAfterViewInit() {
    this.onControlPanelMouseLeave();
  }

  startAllMiners() {
    this.minersPanel.startAllMiners();
    this.updateMinersStats(this.minersPanel.miners);
  }

  pauseAllMiners() {
    this.minersPanel.pauseAllMiners();
    this.updateMinersStats(this.minersPanel.miners);
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

  private updateMinersStats(miners: Node[]) {
    // Atualiza o total de mineradores
    this.minersTotal = miners.length;
    // Referencia os mineradores que estão minerando
    const minersMining = miners.filter((m) => m.isMining);
    // Atualiza o total de mineradores que estão minerando
    this.minersMiningCount = minersMining.length;
    // Atualiza a taxa de hash da rede
    this.realNetworkHashRate = minersMining.reduce(
      (sum, m) => sum + m.currentHashRate,
      0
    );
    // Atualiza o total de mineradores que podem ser pausados
    this.minersToPauseCount = minersMining.length;
    // Atualiza o total de mineradores que podem ser iniciados
    this.minersToStartCount = miners.filter(
      (m) => !m.isMining && (!m.isSyncing || m.initialSyncComplete)
    ).length;
  }
}
