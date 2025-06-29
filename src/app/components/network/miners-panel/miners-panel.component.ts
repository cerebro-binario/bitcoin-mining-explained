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
  miners$!: Observable<Node[]>;
  miners: Node[] = [];
  maximizedMiner?: Node;
  lastCollapsed: boolean = false;

  @ViewChildren(MinerComponent) minerComponents!: QueryList<MinerComponent>;

  constructor(
    public network: BitcoinNetworkService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.miners$ = this.network.nodes$.pipe(
      map((nodes) => nodes.filter((n) => n.nodeType === 'miner')),
      tap((miners) => {
        this.miners = miners;
      })
    );
  }

  addMiner() {
    const allCollapsed = this.network.stats.allCollapsed;
    const miner = this.network.addNode('miner', undefined, null, allCollapsed);
    miner.name = `Minerador ${miner.id}`;
  }

  startAllMiners() {
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.startMining();
    });
  }

  pauseAllMiners() {
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.stopMining();
    });
  }

  setOrToggleAllMinersCollapsed(collapsed?: boolean) {
    if (!this.minerComponents) return;
    const newCollapsed = collapsed ?? !this.network.stats.allCollapsed;
    this.minerComponents.forEach((minerComponent) => {
      minerComponent.setOrToggleCollapsed(newCollapsed);
    });
  }

  setDefaultHashRate(hashRate: number | null) {
    this.network.setDefaultHashRate(hashRate);
  }

  onMinerRemoved(miner: Node) {
    this.network.removeNode(miner.id!);
  }

  onConnectToPeersRequested(miner: Node) {
    miner.searchPeersToConnect(this.network.nodes);
  }

  onMiningChanged(miner: Node) {
    // Os stats são calculados dinamicamente no serviço
  }

  onMinerCollapsedChange(miner: Node) {
    // Os stats são calculados dinamicamente no serviço
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
    // Os stats são calculados dinamicamente no serviço
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

  ngOnDestroy() {
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
  }
}
