import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';

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
        <ng-container *ngFor="let node of network.nodes; let i = index">
          <!-- Draw edges -->
          <ng-container *ngFor="let neighbor of node.neighbors">
            <line
              *ngIf="getNodeById(neighbor.nodeId) as target"
              [attr.x1]="getX(i)"
              [attr.y1]="getY(i)"
              [attr.x2]="getX(getIndexById(neighbor.nodeId))"
              [attr.y2]="getY(getIndexById(neighbor.nodeId))"
              stroke="#888"
              stroke-width="2"
              [attr.opacity]="0.7"
            />
          </ng-container>
        </ng-container>
        <!-- Draw nodes -->
        <ng-container *ngFor="let node of network.nodes; let i = index">
          <circle
            [attr.cx]="getX(i)"
            [attr.cy]="getY(i)"
            r="24"
            [attr.fill]="node.isMiner ? '#2563eb' : '#22d3ee'"
            stroke="#fff"
            stroke-width="2"
          />
          <text
            [attr.x]="getX(i)"
            [attr.y]="getY(i) + 5"
            text-anchor="middle"
            font-size="14"
            fill="#fff"
            font-weight="bold"
          >
            {{ node.isMiner ? 'M' : 'N' }}{{ node.id }}
          </text>
        </ng-container>
      </svg>
    </div>
  `,
  styleUrls: [],
})
export class GraphPlotComponent {
  width = 700;
  height = 400;

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
  getNodeById(id: number) {
    return this.network.nodes.find((n) => n.id === id);
  }
  getIndexById(id: number) {
    return this.network.nodes.findIndex((n) => n.id === id);
  }
}
