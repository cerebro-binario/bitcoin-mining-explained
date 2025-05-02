import { CommonModule } from '@angular/common';
import { Component, OnDestroy, QueryList, ViewChildren } from '@angular/core';
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
  private miningInterval?: any;
  private readonly MINING_INTERVAL = 1; // ms
  private readonly TARGET_FRAME_TIME = 16; // ms (60 FPS)
  private readonly MIN_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 10000;
  private readonly ADJUSTMENT_INTERVAL = 1000; // ms
  private lastAdjustmentTime = 0;
  private currentBatchSize = 1000;
  private frameTimes: number[] = [];
  private readonly FRAME_TIME_HISTORY_SIZE = 10;

  @ViewChildren('minerComponent') minerComponents!: QueryList<MinerComponent>;

  hashRateOptions = [
    { value: 1, label: '1 H/s' },
    { value: 100, label: '100 H/s' },
    { value: 1000, label: '1000 H/s' },
    { value: null, label: 'Máximo' },
  ];

  constructor(
    public network: BitcoinNetworkService,
    private addressService: AddressService
  ) {
    this.startMiningInterval();
  }

  get miners() {
    return this.network.nodes.filter((n) => n.isMiner);
  }

  get globalHashRate(): number | null {
    const rates = this.miners.map((m) => m.hashRate);
    return rates.length > 0 && rates.every((r) => r === rates[0])
      ? rates[0]
      : null;
  }

  private startMiningInterval() {
    this.miningInterval = setInterval(() => {
      const startTime = performance.now();
      const now = Date.now();

      // Calcula o batch size adaptativo
      const adaptiveBatchSize = this.calculateAdaptiveBatchSize();

      this.miners.forEach((miner) => {
        if (miner.isMining) {
          const minerComponent = this.getMinerComponent(miner.id);
          if (minerComponent) {
            minerComponent.processMiningTick(miner, now, adaptiveBatchSize);
          }
        }
      });

      // Mede o tempo de execução do frame
      const frameTime = performance.now() - startTime;
      this.updateFrameTime(frameTime);
    }, this.MINING_INTERVAL);
  }

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
    const activeMiners = this.miners.filter((m) => m.isMining).length;
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

  private getMinerComponent(
    minerId: number | undefined
  ): MinerComponent | null {
    if (minerId === undefined) return null;
    return this.minerComponents.find((c) => c.miner.id === minerId) || null;
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

  startAllMiners() {
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.startMining(minerComponent.miner);
    });
  }

  pauseAllMiners() {
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.stopMining(minerComponent.miner);
    });
  }

  setGlobalHashRate(value: number | null) {
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.setHashRate(value);
    });
  }

  ngOnDestroy() {
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
    }
  }
}
