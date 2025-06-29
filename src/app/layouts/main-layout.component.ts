import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GraphPlotComponent } from '../components/network/graph-plot/graph-plot.component';
import { BitcoinNetworkService } from '../services/bitcoin-network.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, GraphPlotComponent],
  template: `
    <div class="flex flex-row w-full h-full pt-16">
      <!-- Sidebar/contexto -->
      <aside
        class="flex flex-col bg-zinc-900 border-r border-zinc-800 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto"
      >
        <div class="flex gap-2 p-4 border-b border-zinc-800 bg-zinc-900">
          <button
            (click)="addMiner()"
            class="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 text-sm font-semibold flex items-center gap-1 transition"
          >
            <i class="pi pi-cog"></i> Minerador
          </button>
          <button
            (click)="addNode()"
            class="bg-green-600 hover:bg-green-700 text-white rounded px-3 py-2 text-sm font-semibold flex items-center gap-1 transition"
          >
            <i class="pi pi-server"></i> Nó
          </button>
          <button
            (click)="addUser()"
            class="bg-yellow-500 hover:bg-yellow-600 text-zinc-900 rounded px-3 py-2 text-sm font-semibold flex items-center gap-1 transition"
          >
            <i class="pi pi-user"></i> Usuário
          </button>
        </div>
        <div
          class="flex-1 flex items-center justify-center p-2 max-h-[500px] aspect-square"
        >
          <app-graph-plot
            class="w-full h-full"
            (nodeSelected)="goToProfile($event)"
          />
        </div>
      </aside>
      <!-- Conteúdo principal -->
      <main class="flex-1 min-h-0">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class MainLayoutComponent {
  constructor(public bitcoinNetwork: BitcoinNetworkService) {}

  addMiner() {
    this.bitcoinNetwork.addNode('miner');
  }
  addNode() {
    this.bitcoinNetwork.addNode('peer');
  }
  addUser() {
    this.bitcoinNetwork.addNode('user');
  }
  goToProfile(node: any) {
    if (node.nodeType === 'miner') {
      window.location.href = `/miners/${node.id}`;
    } else if (node.nodeType === 'peer') {
      window.location.href = `/peers/${node.id}`;
    } else if (node.nodeType === 'user') {
      window.location.href = `/users/${node.id}`;
    }
  }
}
