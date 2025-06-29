import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ControlPanelComponent } from '../components/network/control-panel/control-panel.component';
import { GraphPlotComponent } from '../components/network/graph-plot/graph-plot.component';
import { BitcoinNetworkService } from '../services/bitcoin-network.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    GraphPlotComponent,
    ControlPanelComponent,
    CommonModule,
  ],
  template: `
    <div class="flex flex-row w-full h-full pt-16">
      <!-- Sidebar/contexto -->
      <aside
        class="flex flex-col bg-zinc-900 border-r border-zinc-800 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto relative"
        [style.width.px]="sidebarWidth"
        [style.minWidth.px]="480"
      >
        <div class="flex gap-2 p-4 border-b border-zinc-800 bg-zinc-900">
          <button
            (click)="addMiner()"
            class="bg-blue-500/90 hover:bg-blue-600 text-white rounded-xl px-4 py-2 text-base font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-300/40"
          >
            <span class="text-sm text-white/70 align-middle">+</span>
            <i class="pi pi-cog text-lg opacity-80 ml-1"></i>
            Minerador
          </button>
          <button
            (click)="addNode()"
            class="bg-green-500/90 hover:bg-green-600 text-white rounded-xl px-4 py-2 text-base font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-300/40"
          >
            <span class="text-sm text-white/70 align-middle">+</span>
            <i class="pi pi-server text-lg opacity-80 ml-1"></i>
            Nó
          </button>
          <button
            (click)="addUser()"
            class="bg-yellow-400/90 hover:bg-yellow-500 text-zinc-900 rounded-xl px-4 py-2 text-base font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-300/40"
          >
            <span class="text-sm text-zinc-900/70 align-middle">+</span>
            <i class="pi pi-user text-lg opacity-80 ml-1"></i>
            Usuário
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
        <!-- Botão de consenso global -->
        <div class="w-full px-4 pt-4">
          <button
            class="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-zinc-800 text-white font-semibold text-lg border border-zinc-700 hover:border-blue-400 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] hover:text-blue-200 focus:outline-none transition-all duration-200 mb-4"
            (click)="goToGlobalConsensus()"
          >
            <i class="pi pi-cog text-xl text-blue-400"></i>
            Consenso Global
          </button>
        </div>
        <div class="px-4 pb-4 pt-2">
          <app-control-panel
            [stats]="bitcoinNetwork.stats"
            [hashRateOptions]="hashRateOptions"
            (startAll)="startAllMiners()"
            (pauseAll)="pauseAllMiners()"
            (setDefaultHashRate)="setDefaultHashRate($event)"
            (toggleAllMinersCollapse)="toggleAllMinersCollapse()"
          ></app-control-panel>
        </div>
        <!-- Grip para redimensionar -->
        <div
          class="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-50 bg-transparent hover:bg-blue-500/10 transition"
          (mousedown)="onResizeStart($event)"
        ></div>
      </aside>
      <!-- Overlay para capturar mousemove/mouseup -->
      <div
        *ngIf="resizing"
        class="fixed inset-0 z-40"
        (mousemove)="onResize($event)"
        (mouseup)="onResizeEnd()"
        style="cursor: ew-resize;"
      ></div>
      <!-- Conteúdo principal -->
      <main class="flex-1 min-h-0">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class MainLayoutComponent {
  hashRateOptions = [
    { value: 1, label: '1 H/s' },
    { value: 1000, label: '1000 H/s' },
    { value: 10000, label: '10000 H/s' },
    { value: null, label: 'Máximo' },
  ];

  sidebarWidth = 340; // valor inicial em px
  resizing = false;

  constructor(
    public bitcoinNetwork: BitcoinNetworkService,
    private router: Router
  ) {}

  onResizeStart(event: MouseEvent) {
    this.resizing = true;
    event.preventDefault();
  }

  onResize(event: MouseEvent) {
    if (this.resizing) {
      // Limite mínimo/máximo opcional
      this.sidebarWidth = Math.max(480, Math.min(600, event.clientX));
    }
  }

  onResizeEnd() {
    this.resizing = false;
  }

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
      this.router.navigate(['/miners', node.id]);
    } else if (node.nodeType === 'peer') {
      this.router.navigate(['/peers', node.id]);
    } else if (node.nodeType === 'user') {
      this.router.navigate(['/users', node.id]);
    }
  }
  goToGlobalConsensus() {
    this.router.navigate(['/global-consensus']);
  }
  startAllMiners() {
    this.bitcoinNetwork.startAllMiners();
  }
  pauseAllMiners() {
    this.bitcoinNetwork.pauseAllMiners();
  }
  setDefaultHashRate(value: number | null) {
    this.bitcoinNetwork.setDefaultHashRate(value);
  }
  toggleAllMinersCollapse() {
    // Método não implementado no serviço. Pode ser implementado se necessário.
  }
}
