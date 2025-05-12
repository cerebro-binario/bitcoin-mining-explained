import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Node } from '../../../../../models/node';
import { BitcoinNetworkService } from '../../../../../services/bitcoin-network.service';

export interface PeerInfo {
  id: number;
  name: string;
  latency: number;
  blockCount: number;
  consensusVersion: number | string;
  syncStatus: 'in-sync' | 'behind' | 'fork' | 'unknown';
  syncTooltip: string;
}

@Component({
  selector: 'app-peers-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './peers-dialog.component.html',
  styleUrls: ['./peers-dialog.component.scss'],
})
export class PeersDialogComponent implements OnInit, OnDestroy {
  @Input() miner!: Node;
  @Output() close = new EventEmitter<void>();

  peerInfos: PeerInfo[] = [];

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private elRef: ElementRef,
    private networkService: BitcoinNetworkService
  ) {}

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
    this.computePeerInfos();
  }
  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  private computePeerInfos() {
    const myBlock = this.miner.getLatestBlock?.();
    this.peerInfos = this.miner.neighbors.map((peer) => {
      const peerNode = this.networkService.nodes.find(
        (n: any) => n.id === peer.nodeId
      );
      let blockCount = 0;
      let consensusVersion: number | string = '?';
      let syncStatus: 'in-sync' | 'behind' | 'fork' | 'unknown' = 'unknown';
      let syncTooltip = 'Peer não encontrado';
      let name = peerNode?.name ?? `#${peer.nodeId}`;
      if (peerNode) {
        const peerBlock = peerNode.getLatestBlock?.();
        blockCount = peerBlock ? peerBlock.height + 1 : 0;
        consensusVersion = peerNode?.consensus?.version ?? '?';
        if (myBlock && peerBlock) {
          if (peerBlock.hash === myBlock.hash) {
            syncStatus = 'in-sync';
            syncTooltip = 'Em sync';
          } else if (peerBlock.height > myBlock.height) {
            syncStatus = 'behind';
            syncTooltip = `Atrasado ${
              peerBlock.height - myBlock.height
            } blocos`;
          } else if (
            peerBlock.height === myBlock.height &&
            peerBlock.hash !== myBlock.hash
          ) {
            syncStatus = 'fork';
            syncTooltip = 'Fork';
          } else {
            syncTooltip = 'Status desconhecido';
          }
        } else {
          syncTooltip = 'Sem blocos';
        }
      }
      return {
        id: peer.nodeId,
        name,
        latency: peer.latency,
        blockCount,
        consensusVersion,
        syncStatus,
        syncTooltip,
      };
    });
  }
}
