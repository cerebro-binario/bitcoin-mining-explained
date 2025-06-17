import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import type { Node as BitcoinNode } from '../../../models/node';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';

@Component({
  selector: 'app-graph-plot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-12">
      <h2 class="text-2xl font-semibold mb-4">Visualização da Rede</h2>
      <svg
        [attr.width]="width"
        [attr.height]="height"
        class="bg-zinc-900 rounded shadow border border-zinc-700"
      >
        <!-- Definir gradientes para as animações -->
        <defs>
          <linearGradient id="dataFlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0">
              <animate
                attributeName="offset"
                values="0;1"
                dur="1s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stop-color="#3b82f6" stop-opacity="1">
              <animate
                attributeName="offset"
                values="0;1"
                dur="1s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0">
              <animate
                attributeName="offset"
                values="0;1"
                dur="1s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        <ng-container *ngFor="let node of network.nodes; let i = index">
          <!-- Draw edges -->
          <ng-container *ngFor="let neighbor of node.peers">
            <line
              *ngIf="getNodeById(neighbor.node.id) as target"
              [attr.x1]="getX(i)"
              [attr.y1]="getY(i)"
              [attr.x2]="getX(getIndexById(neighbor.node.id))"
              [attr.y2]="getY(getIndexById(neighbor.node.id))"
              stroke="#888"
              stroke-width="2"
              [attr.opacity]="0.7"
            />
            <!-- Linha animada para tráfego de dados -->
            <line
              *ngIf="node.isSyncing"
              [attr.x1]="getX(getIndexById(neighbor.node.id))"
              [attr.y1]="getY(getIndexById(neighbor.node.id))"
              [attr.x2]="getX(i)"
              [attr.y2]="getY(i)"
              stroke="#3b82f6"
              stroke-width="3"
              class="data-flow"
            />
          </ng-container>
        </ng-container>
        <!-- Draw nodes -->
        <ng-container *ngFor="let node of network.nodes; let i = index">
          <!-- Círculo externo para animação de sincronização -->
          <circle
            *ngIf="node.isSyncing"
            [attr.cx]="getX(i)"
            [attr.cy]="getY(i)"
            r="28"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2"
            stroke-dasharray="4"
            class="sync-circle"
          />
          <!-- Nó principal -->
          <circle
            [attr.cx]="getX(i)"
            [attr.cy]="getY(i)"
            r="24"
            [attr.fill]="
              node.nodeType === 'miner'
                ? '#2563eb'
                : node.nodeType === 'peer'
                ? '#22d3ee'
                : '#6b7280'
            "
            stroke="#fff"
            stroke-width="2"
            (click)="onNodeClick(node)"
            class="cursor-pointer"
          />
          <text
            [attr.x]="getX(i)"
            [attr.y]="getY(i) + 5"
            text-anchor="middle"
            font-size="14"
            fill="#fff"
            font-weight="bold"
            class="pointer-events-none"
          >
            {{
              node.nodeType === 'miner'
                ? 'M'
                : node.nodeType === 'peer'
                ? 'N'
                : 'U'
            }}{{ node.id }}
          </text>
        </ng-container>
      </svg>
    </div>
  `,
  styles: [
    `
      .sync-circle {
        transform-box: fill-box;
        transform-origin: center;
        animation: rotate 2s linear infinite;
      }

      .data-flow {
        stroke: #3b82f6;
        stroke-width: 3;
        stroke-dasharray: 10, 10;
        stroke-dashoffset: 0;
        animation: dashMove 1s linear infinite;
      }

      @keyframes dashMove {
        to {
          stroke-dashoffset: -20;
        }
      }

      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class GraphPlotComponent {
  width = 700;
  height = 400;
  @Output() nodeSelected = new EventEmitter<BitcoinNode>();

  constructor(public network: BitcoinNetworkService) {}

  // Distribui os nodes em círculo
  getX(i: number): number {
    const n = this.network.nodes.length;
    const angle = (2 * Math.PI * i) / n;
    return this.width / 2 + Math.cos(angle) * (this.height / 2.2);
  }
  getY(i: number): number {
    const n = this.network.nodes.length;
    const angle = (2 * Math.PI * i) / n;
    return this.height / 2 + Math.sin(angle) * (this.height / 2.5);
  }
  getNodeById(id: number | undefined) {
    return this.network.nodes.find((n) => n.id === id);
  }
  getIndexById(id: number | undefined) {
    return this.network.nodes.findIndex((n) => n.id === id);
  }
  onNodeClick(node: BitcoinNode) {
    console.log('nodeSelected', node);
    this.nodeSelected.emit(node);
  }
}
