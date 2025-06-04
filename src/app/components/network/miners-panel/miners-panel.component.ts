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
import { Node } from '../../../models/node';
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

  miners$!: Observable<Node[]>;
  miners: Node[] = [];
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
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.miners$ = this.network.nodes$.pipe(
      map((nodes) => nodes.filter((n) => n.isMiner)),
      tap((miners) => {
        this.miners = miners;
        this.updateStats(miners);
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
  }

  startAllMiners() {
    const miners = this.minerComponents.map((minerComponent) => {
      minerComponent.startMining();

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

  onMinerRemoved(miner: Node) {
    this.network.removeNode(miner.id!);
  }

  onConnectToPeersRequested(miner: Node) {
    miner.searchPeersToConnect(this.network.nodes);
  }

  onMiningChanged(miner: Node) {
    this.updateStats(this.miners);
  }

  onMinerCollapsedChange(miner: Node) {
    this.updateStats(this.miners);
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
    this.updateStats(this.miners);
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
        acc.nCanStart += !miner.isMining ? 1 : 0;
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

  ngOnDestroy() {
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
  }
}
