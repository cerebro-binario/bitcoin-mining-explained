import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  EventEmitter,
  Inject,
  OnDestroy,
  Output,
  QueryList,
  Renderer2,
  ViewChildren,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { map, Observable, tap } from 'rxjs';
import { Block } from '../../../models/block.model';
import { Node } from '../../../models/node';
import { AddressService } from '../../../services/address.service';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { MinerComponent } from './miner/miner.component';

export type MinersStats = {
  toCollapse: number;
  toExpand: number;
  allCollapsed: boolean;
  nTotal: number;
  nMining: number;
  nCanStart: number;
  nCanPause: number;
  defaultHashRate: number | null;
  totalHashRate: number;
};

@Component({
  selector: 'app-miners-panel',
  standalone: true,
  imports: [CommonModule, TooltipModule, MinerComponent],
  templateUrl: './miners-panel.component.html',
  styleUrls: ['./miners-panel.component.scss'],
})
export class MinersPanelComponent implements OnDestroy {
  private readonly DEFAULT_HASH_RATE: number | null = 1000;
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
  private lastHashRateUpdate = 0;
  private readonly HASH_RATE_UPDATE_INTERVAL = 1000; // ms

  miners$!: Observable<Node[]>;
  minersStats: MinersStats = {
    toCollapse: 0,
    toExpand: 0,
    allCollapsed: false,
    nTotal: 0,
    nMining: 0,
    nCanStart: 0,
    nCanPause: 0,
    defaultHashRate: this.DEFAULT_HASH_RATE,
    totalHashRate: 0,
  };
  maximizedMiner?: Node;
  lastCollapsed: boolean = false;

  @ViewChildren(MinerComponent) minerComponents!: QueryList<MinerComponent>;

  @Output() statsChange = new EventEmitter<MinersStats>();

  constructor(
    public network: BitcoinNetworkService,
    private addressService: AddressService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.startMiningInterval();
    this.miners$ = this.network.nodes$.pipe(
      map((nodes) => nodes.filter((n) => n.isMiner)),
      tap((miners) => {
        this.updateStats(miners);

        const toInitialize = miners.filter(
          (miner) => !miner.initialSyncComplete
        );
        Promise.all(
          toInitialize.map((miner) => this.network.initializeNode(miner))
        ).then(() => {
          this.updateStats(miners);
        });
      })
    );
  }

  addMiner() {
    const hashRate =
      this.minersStats.defaultHashRate === undefined
        ? this.DEFAULT_HASH_RATE
        : this.minersStats.defaultHashRate;
    const allCollapsed = this.minersStats.allCollapsed;
    const miner = this.network.addNode(true, undefined, hashRate, allCollapsed);
    miner.name = `Minerador ${miner.id}`;
    miner.miningAddress = this.addressService.generateRandomAddress();
  }

  startAllMiners() {
    const miners = this.minerComponents.map((minerComponent) => {
      if (
        !minerComponent.miner.isSyncing ||
        minerComponent.miner.initialSyncComplete
      ) {
        minerComponent.startMining();
      }

      return minerComponent.miner;
    });
    this.updateStats(miners);
  }

  pauseAllMiners() {
    const miners = this.minerComponents.map((minerComponent) => {
      minerComponent.stopMining();
      return minerComponent.miner;
    });
    this.updateStats(miners);
  }

  setOrToggleAllMinersCollapsed(collapsed?: boolean) {
    if (!this.minerComponents) return;
    const newCollapsed = collapsed ?? !this.minersStats.allCollapsed;
    const miners = this.minerComponents.map((minerComponent) => {
      minerComponent.setOrToggleCollapsed(newCollapsed);
      return minerComponent.miner;
    });
    this.updateStats(miners);
  }

  setDefaultHashRate(hashRate: number | null) {
    this.minersStats.defaultHashRate = hashRate;
    this.statsChange.emit(this.minersStats);

    this.minerComponents.forEach((component) => {
      component.setHashRate(hashRate);
    });
  }

  onBlockBroadcasted(event: { minerId: number; block: Block }) {
    this.network.propagateBlock(event.minerId, event.block);
  }

  onMinerRemoved(miner: Node) {
    this.network.removeNode(miner.id!);
  }

  onConnectToPeersRequested(miner: Node) {
    this.network.connectToRandomPeers(miner);
  }

  onMiningChanged(miner: Node) {
    if (miner.isMining) {
      this.minersStats.nMining++;
      this.minersStats.nCanStart--;
      this.minersStats.nCanPause++;
    } else {
      this.minersStats.nMining--;
      this.minersStats.nCanStart++;
      this.minersStats.nCanPause--;
    }

    this.statsChange.emit(this.minersStats);
  }

  onMinerCollapsedChange(miner: Node) {
    if (miner.isCollapsed) {
      this.minersStats.toCollapse--;
      this.minersStats.toExpand++;
    } else {
      this.minersStats.toExpand--;
      this.minersStats.toCollapse++;
    }
    this.minersStats.allCollapsed = this.minersStats.toCollapse === 0;
    this.statsChange.emit(this.minersStats);
  }

  onMinerMaximizedChange(miner: Node) {
    this.maximizedMiner = miner.isMaximized ? miner : undefined;

    if (this.maximizedMiner) {
      this.lastCollapsed = miner.isCollapsed;
      this.maximizedMiner.isCollapsed = false;
      this.renderer.addClass(this.document.body, 'overflow-hidden');
    } else {
      miner.isCollapsed = this.lastCollapsed;
      this.renderer.removeClass(this.document.body, 'overflow-hidden');
    }
  }

  onLogsMaximizedChange(miner: Node) {
    if (miner.isLogsMaximized) {
      this.renderer.addClass(this.document.body, 'overflow-hidden');
    } else {
      this.renderer.removeClass(this.document.body, 'overflow-hidden');
    }
  }

  onHashRateChange(hashRate: number | null) {
    // 1. Se todos os miners tiverem o mesmo hash rate, esse será o default
    // 2. Caso contrário, usará o padrão DEFAULT_HASH_RATE
    let newDefault: number | null = this.DEFAULT_HASH_RATE;
    let newTotal = 0;
    if (this.minerComponents && this.minerComponents.length > 0) {
      const rates = this.minerComponents.map((m) => {
        newTotal += m.miner.currentHashRate;
        return m.miner.hashRate;
      });
      const allEqual = rates.every((r) => r === rates[0]);
      newDefault = allEqual ? rates[0] : this.DEFAULT_HASH_RATE;
    }
    this.minersStats.defaultHashRate = newDefault;
    this.minersStats.totalHashRate = newTotal;
    this.statsChange.emit(this.minersStats);
  }

  onBackdropClick(event: MouseEvent, miner: Node) {
    if (event.target === event.currentTarget) {
      if (miner.isLogsMaximized) {
        miner.isLogsMaximized = false;
        this.onLogsMaximizedChange(miner);
      } else {
        miner.isMaximized = false;
        this.onMinerMaximizedChange(miner);
      }
    }
  }

  private updateStats(miners: Node[]) {
    this.minersStats = miners.reduce(
      (acc, miner, i) => {
        acc.allCollapsed =
          i === 0 ? miner.isCollapsed : acc.allCollapsed && miner.isCollapsed;
        acc.toCollapse += !miner.isCollapsed ? 1 : 0;
        acc.toExpand += miner.isCollapsed ? 1 : 0;
        acc.nTotal++;
        acc.nMining += miner.isMining ? 1 : 0;
        acc.nCanStart +=
          !miner.isMining && (!miner.isSyncing || miner.initialSyncComplete)
            ? 1
            : 0;
        acc.nCanPause += miner.isMining ? 1 : 0;
        acc.totalHashRate += miner.currentHashRate;
        return acc;
      },
      {
        allCollapsed: false,
        toCollapse: 0,
        toExpand: 0,
        nTotal: 0,
        nMining: 0,
        nCanStart: 0,
        nCanPause: 0,
        defaultHashRate: this.DEFAULT_HASH_RATE,
        totalHashRate: 0,
      } as MinersStats
    );

    if (miners.length > 0) {
      const rates = miners.map((m) => m.hashRate);
      const allEqual = rates.every((r) => r === rates[0]);
      this.minersStats.defaultHashRate = allEqual
        ? rates[0]
        : this.minersStats.defaultHashRate;
    }

    this.statsChange.emit(this.minersStats);
  }

  private startMiningInterval() {
    this.miningInterval = setInterval(() => {
      const startTime = performance.now();
      const now = Date.now();

      // Calcula o batch size adaptativo
      const adaptiveBatchSize = this.calculateAdaptiveBatchSize();

      let currentHashRate = 0;
      this.minerComponents.forEach((component) => {
        if (component && component.miner.isMining) {
          component.processMiningTick(now, adaptiveBatchSize);
          currentHashRate += component.miner.currentHashRate;
        }
      });

      // Só atualiza o totalHashRate a cada HASH_RATE_UPDATE_INTERVAL ms
      if (now - this.lastHashRateUpdate >= this.HASH_RATE_UPDATE_INTERVAL) {
        this.minersStats.totalHashRate = currentHashRate;
        this.statsChange.emit(this.minersStats);
        this.lastHashRateUpdate = now;
      }

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
    const activeMiners = this.minerComponents.filter(
      (m) => m.miner.isMining
    ).length;
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
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
    }
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
  }
}
