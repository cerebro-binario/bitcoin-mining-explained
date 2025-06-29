import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ThemeService } from '../services/theme.service';
import { BitcoinNetworkService } from '../services/bitcoin-network.service';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { GraphPlotComponent } from '../components/network/graph-plot/graph-plot.component';

@Component({
  selector: 'app-root-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    NgIf,
    GraphPlotComponent,
  ],
  template: `
    <div class="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <!-- Navbar Global Fixa -->
      <nav
        class="fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800 shadow-lg"
      >
        <div class="px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <!-- Logo/Brand -->
            <div class="flex items-center">
              <a
                routerLink="/"
                class="flex items-center space-x-2 text-xl font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <i class="pi pi-bitcoin text-2xl"></i>
                <span class="hidden sm:inline">Bitcoin Mining Explained</span>
                <span class="sm:hidden">BME</span>
              </a>
            </div>

            <!-- Navigation Links -->
            <div class="hidden md:flex items-center space-x-8">
              <a
                routerLink="/"
                routerLinkActive="text-blue-400 border-b-2 border-blue-400"
                class="text-zinc-300 hover:text-blue-400 transition-colors py-2 px-1 border-b-2 border-transparent"
              >
                <i class="pi pi-globe mr-2"></i>
                Rede
              </a>
              <a
                routerLink="/tools"
                routerLinkActive="text-blue-400 border-b-2 border-blue-400"
                class="text-zinc-300 hover:text-blue-400 transition-colors py-2 px-1 border-b-2 border-transparent"
              >
                <i class="pi pi-wrench mr-2"></i>
                Ferramentas
              </a>
            </div>

            <!-- Mobile menu button -->
            <div class="md:hidden">
              <button
                type="button"
                class="text-zinc-300 hover:text-blue-400 transition-colors"
                (click)="toggleMobileMenu()"
              >
                <i class="pi pi-bars text-xl"></i>
              </button>
            </div>
          </div>

          <!-- Mobile menu -->
          <div
            *ngIf="mobileMenuOpen"
            class="md:hidden border-t border-zinc-800"
          >
            <div class="px-2 pt-2 pb-3 space-y-1">
              <a
                routerLink="/"
                routerLinkActive="bg-zinc-800 text-blue-400"
                class="block px-3 py-2 rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-blue-400 transition-colors"
                (click)="closeMobileMenu()"
              >
                <i class="pi pi-globe mr-2"></i>
                Rede
              </a>
              <a
                routerLink="/tools"
                routerLinkActive="bg-zinc-800 text-blue-400"
                class="block px-3 py-2 rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-blue-400 transition-colors"
                (click)="closeMobileMenu()"
              >
                <i class="pi pi-wrench mr-2"></i>
                Ferramentas
              </a>
            </div>
          </div>
        </div>
      </nav>

      <!-- Layout em 2 colunas: Sidebar fluida (grafo) + Conteúdo principal -->
      <div class="flex flex-row flex-1 pt-16 w-full">
        <!-- Sidebar fluida com grafo -->
        <aside
          class="flex flex-col bg-zinc-900 border-r border-zinc-800 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto"
        >
          <!-- Botões de adicionar -->
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
          <!-- Grafo ocupa o restante -->
          <div class="flex-1 flex items-center justify-center p-2 max-w-[35vw]">
            <app-graph-plot
              class="w-full h-full"
              (nodeSelected)="goToProfile($event)"
            />
          </div>
        </aside>
        <!-- Conteúdo principal -->
        <main class="flex-1 min-h-0 bg-zinc-950">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
})
export class RootLayout {
  mobileMenuOpen = false;

  bitcoinNetwork = inject(BitcoinNetworkService);
  router = inject(Router);

  miners$ = this.bitcoinNetwork.nodes$.pipe(
    map((nodes) => nodes.filter((n) => n.nodeType === 'miner'))
  );
  peers$ = this.bitcoinNetwork.nodes$.pipe(
    map((nodes) => nodes.filter((n) => n.nodeType === 'peer'))
  );
  users$ = this.bitcoinNetwork.nodes$.pipe(
    map((nodes) => nodes.filter((n) => n.nodeType === 'user'))
  );

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    const theme = this.themeService.getTheme();
    this.themeService.applyTheme(theme);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
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
}
