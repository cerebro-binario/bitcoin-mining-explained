import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  Output,
  QueryList,
  Renderer2,
  ViewChildren,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { Block } from '../../../models/block.model';
import { Node } from '../../../models/node';
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
export class MinersPanelComponent implements OnDestroy, AfterViewInit {
  private readonly DEFAULT_HASH_RATE = 1000;
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
  private _defaultHashRate: number | null = this.DEFAULT_HASH_RATE;
  private _allMinersCollapsed = false;
  private _minersToExpandCount = 0;
  private _minersToCollapseCount = 0;

  @ViewChildren(MinerComponent) minerComponents!: QueryList<MinerComponent>;

  @Input() miners: Node[] = [];
  @Input() set allMinersCollapsed(value: boolean) {
    if (value !== this._allMinersCollapsed) {
      this._allMinersCollapsed = value;
      this.allMinersCollapsedChange.emit(value);
    }
  }
  @Input() set minersToExpandCount(value: number) {
    if (value !== this._minersToExpandCount) {
      this._minersToExpandCount = value;
      this.minersToExpandCountChange.emit(value);
    }
  }
  @Input() set minersToCollapseCount(value: number) {
    if (value !== this._minersToCollapseCount) {
      this._minersToCollapseCount = value;
      this.minersToCollapseCountChange.emit(value);
    }
  }
  @Input() set defaultHashRate(value: number | null) {
    if (value !== this._defaultHashRate) {
      this._defaultHashRate = value;
      this.defaultHashRateChange.emit(value);
    }
  }

  @Output() allMinersCollapsedChange = new EventEmitter<boolean>();
  @Output() minersToExpandCountChange = new EventEmitter<number>();
  @Output() minersToCollapseCountChange = new EventEmitter<number>();
  @Output() defaultHashRateChange = new EventEmitter<number | null>();

  maximizedMiner?: Node;

  constructor(
    public network: BitcoinNetworkService,
    private addressService: AddressService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.startMiningInterval();
  }

  ngAfterViewInit() {
    this.updateMinersCollapseCounts();
    this.checkAllMinersCollapsed();
  }

  get defaultHashRate(): number | null | undefined {
    const rates = this.miners.map((m) => m.hashRate);
    return rates.length > 0 && rates.every((r) => r === rates[0])
      ? rates[0]
      : this._defaultHashRate;
  }

  get networkHashRate(): number {
    // Soma apenas dos mineradores ativos (isMining)
    return this.miners
      .filter((m) => m.isMining && m.hashRate != null)
      .reduce((sum, m) => sum + (m.hashRate || 0), 0);
  }

  checkAllMinersCollapsed() {
    this.allMinersCollapsed =
      this.minerComponents && this.minerComponents.length > 0
        ? this.minerComponents.toArray().every((m) => m.isCollapsed)
        : false;
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
    const hashRate =
      this.defaultHashRate === undefined ? 1000 : this.defaultHashRate;
    const miner = this.network.addNode(true, undefined, hashRate);
    miner.name = `Minerador ${miner.id}`;
    miner.miningAddress = this.addressService.generateRandomAddress();
    this.network.initializeNode(miner);

    this.updateMinersCollapseCounts();
    this.checkAllMinersCollapsed();
  }

  onBlockBroadcasted(event: { minerId: number; block: Block }) {
    this.network.propagateBlock(event.minerId, event.block);
  }

  onMinerRemoved(event: { minerId: number }) {
    this.network.removeNode(event.minerId);
    this.updateMinersCollapseCounts();
    this.checkAllMinersCollapsed();
  }

  startAllMiners() {
    this.minerComponents.forEach((minerComponent) => {
      if (
        !minerComponent.miner.isSyncing ||
        minerComponent.miner.initialSyncComplete
      ) {
        minerComponent.startMining(minerComponent.miner);
      }
    });
  }

  pauseAllMiners() {
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.stopMining(minerComponent.miner);
    });
  }

  toggleAllMinersCollapse() {
    if (!this.minerComponents) return;
    this.minerComponents.forEach(
      (m) => (m.isCollapsed = !this.allMinersCollapsed)
    );
    this.allMinersCollapsed = !this.allMinersCollapsed;
    this.updateMinersCollapseCounts();
  }

  onMinerCollapsed(collapsed: boolean) {
    this.checkAllMinersCollapsed();
    this.updateMinersCollapseCounts();
  }

  onMinerMaximized(miner: Node) {
    this.maximizedMiner = miner;
    this.renderer.addClass(this.document.body, 'overflow-hidden');
  }

  onMinerMinimized(miner: Node) {
    this.maximizedMiner = undefined;
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
  }

  onLogsMaximized() {
    this.renderer.addClass(this.document.body, 'overflow-hidden');
  }

  onLogsMinimized() {
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
  }

  updateMinersCollapseCounts() {
    if (this.minerComponents) {
      this.minersToExpandCount = this.minerComponents
        .toArray()
        .filter((m) => m.isCollapsed).length;
      this.minersToCollapseCount = this.minerComponents
        .toArray()
        .filter((m) => !m.isCollapsed).length;
    }
  }

  ngOnDestroy() {
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
    }
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
  }
}
