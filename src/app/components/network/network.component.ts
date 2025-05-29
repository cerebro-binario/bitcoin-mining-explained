import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Node } from '../../models/node';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';
import {
  MinersPanelComponent,
  MinersStats,
} from './miners-panel/miners-panel.component';
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
export class NetworkComponent {
  private readonly MINING_INTERVAL = 1; // ms
  private readonly HASH_RATE_UPDATE_INTERVAL = 1000; // ms
  private readonly FRAME_TIME_HISTORY_SIZE = 10;
  private readonly ADJUSTMENT_INTERVAL = 1000; // ms
  private readonly TARGET_FRAME_TIME = 16; // ms (60 FPS)
  private readonly MIN_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 10000;

  private fadeTimeout: any;
  private miningTimeout: any;

  private frameTimes: number[] = [];
  private lastHashRateUpdate = 0;
  private lastAdjustmentTime = 0;
  private currentBatchSize = 1000;

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

  nodes: Node[] = [];

  constructor(public network: BitcoinNetworkService) {
    this.network.nodes$.pipe(takeUntilDestroyed()).subscribe((nodes) => {
      this.nodes = nodes;
    });
  }

  ngAfterViewInit() {
    this.onControlPanelMouseLeave();
    this.startMiningLoop();
  }

  // Método para iniciar o loop de mineração
  startMiningLoop() {
    if (this.miningTimeout) {
      clearTimeout(this.miningTimeout);
    }
    this.runMiningLoop();
  }

  // Método para parar o loop de mineração
  stopMiningLoop() {
    if (this.miningTimeout) {
      clearTimeout(this.miningTimeout);
      this.miningTimeout = null;
    }
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
    requestAnimationFrame(() => {
      this.stats = { ...stats };
    });
  }

  private runMiningLoop = () => {
    const startTime = performance.now();
    const now = Date.now();

    // Calcula o batch size adaptativo
    const adaptiveBatchSize = this.calculateAdaptiveBatchSize();

    let currentHashRate = 0;

    this.nodes.forEach((node) => {
      if (!node) return;

      if (node.isMining) {
        node.processMiningTick(now, adaptiveBatchSize);
        currentHashRate += node.currentHashRate;
      }

      // Autobusca de peers (com cooldown)
      if (now - node.lastPeerSearch > node.peerSearchInterval) {
        node.lastPeerSearch = now;
        node.searchPeersToConnect(this.nodes);
      }
    });

    // Só atualiza o totalHashRate a cada HASH_RATE_UPDATE_INTERVAL ms
    if (now - this.lastHashRateUpdate >= this.HASH_RATE_UPDATE_INTERVAL) {
      this.stats.totalHashRate = currentHashRate;
      this.lastHashRateUpdate = now;
    }

    // Mede o tempo de execução do frame
    const frameTime = performance.now() - startTime;
    this.updateFrameTime(frameTime);

    // Agenda o próximo ciclo
    this.miningTimeout = setTimeout(this.runMiningLoop, this.MINING_INTERVAL);
  };

  private calculateAdaptiveBatchSize(): number {
    const now = Date.now();

    // Ajusta o batch size periodicamente
    if (now - this.lastAdjustmentTime >= this.ADJUSTMENT_INTERVAL) {
      this.lastAdjustmentTime = now;

      // Calcula a média dos últimos tempos de frame
      const avgFrameTime =
        this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

      // Ajusta o batch size baseado no tempo médio de frame
      if (avgFrameTime > this.TARGET_FRAME_TIME) {
        // Reduz o batch size se estiver muito lento
        this.currentBatchSize = Math.max(
          this.MIN_BATCH_SIZE,
          Math.floor(this.currentBatchSize * 0.8)
        );
      } else if (avgFrameTime < this.TARGET_FRAME_TIME * 0.8) {
        // Aumenta o batch size se estiver muito rápido
        this.currentBatchSize = Math.min(
          this.MAX_BATCH_SIZE,
          Math.floor(this.currentBatchSize * 1.2)
        );
      }

      // Limpa o histórico de tempos
      this.frameTimes = [];
    }

    // Ajusta o batch size baseado no número de miners
    const activeMiners = this.nodes.filter((n) => n.isMining).length;
    const minerAdjustedBatchSize = Math.floor(
      this.currentBatchSize / Math.max(1, activeMiners)
    );

    return Math.max(this.MIN_BATCH_SIZE, minerAdjustedBatchSize);
  }

  private updateFrameTime(frameTime: number) {
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.FRAME_TIME_HISTORY_SIZE) {
      this.frameTimes.shift();
    }
  }

  ngOnDestroy() {
    if (this.miningTimeout) {
      clearTimeout(this.miningTimeout);
    }
  }
}
