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

@Component({
  selector: 'app-root-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    NgIf,
    NgFor,
    AsyncPipe,
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

      <!-- Main Content com sidebar fixa -->
      <div class="flex flex-row flex-1 pt-16">
        <!-- Sidebar lateral -->
        <aside
          class="w-72 bg-zinc-900 border-r border-zinc-800 h-[calc(100vh-4rem)] flex flex-col py-6 px-4 gap-6 sticky top-16 overflow-y-auto"
        >
          <!-- Mineradores -->
          <div>
            <div
              class="flex items-center gap-2 mb-2 text-blue-400 font-bold text-lg"
            >
              <i class="pi pi-cog"></i>
              Mineradores
              <button
                (click)="addMiner()"
                class="ml-auto bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 text-xs font-semibold flex items-center gap-1 transition"
              >
                <i class="pi pi-plus"></i> Add
              </button>
            </div>
            <ul class="flex flex-col gap-1">
              <li
                *ngFor="let miner of miners$ | async"
                class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-900/30 transition cursor-pointer"
                (click)="goToProfile(miner)"
              >
                <i class="pi pi-cog text-blue-400"></i>
                <span class="truncate">{{
                  miner.name || 'Minerador ' + miner.id
                }}</span>
                <span
                  *ngIf="miner.isMining"
                  class="ml-auto text-xs bg-green-600 px-2 py-0.5 rounded"
                  >On</span
                >
              </li>
            </ul>
          </div>

          <!-- Nós -->
          <div>
            <div
              class="flex items-center gap-2 mb-2 text-green-400 font-bold text-lg"
            >
              <i class="pi pi-server"></i>
              Nós
              <button
                (click)="addNode()"
                class="ml-auto bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 text-xs font-semibold flex items-center gap-1 transition"
              >
                <i class="pi pi-plus"></i> Add
              </button>
            </div>
            <ul class="flex flex-col gap-1">
              <li
                *ngFor="let node of peers$ | async"
                class="flex items-center gap-2 px-3 py-2 rounded hover:bg-green-900/30 transition cursor-pointer"
                (click)="goToProfile(node)"
              >
                <i class="pi pi-server text-green-400"></i>
                <span class="truncate">{{ node.name || 'Nó ' + node.id }}</span>
              </li>
            </ul>
          </div>

          <!-- Usuários -->
          <div>
            <div
              class="flex items-center gap-2 mb-2 text-yellow-400 font-bold text-lg"
            >
              <i class="pi pi-user"></i>
              Usuários
              <button
                (click)="addUser()"
                class="ml-auto bg-yellow-500 hover:bg-yellow-600 text-zinc-900 rounded px-2 py-1 text-xs font-semibold flex items-center gap-1 transition"
              >
                <i class="pi pi-plus"></i> Add
              </button>
            </div>
            <ul class="flex flex-col gap-1">
              <li
                *ngFor="let user of users$ | async"
                class="flex items-center gap-2 px-3 py-2 rounded hover:bg-yellow-900/30 transition cursor-pointer"
                (click)="goToProfile(user)"
              >
                <i class="pi pi-user text-yellow-400"></i>
                <span class="truncate">{{
                  user.name || 'Usuário ' + user.id
                }}</span>
              </li>
            </ul>
          </div>
        </aside>
        <!-- Conteúdo principal -->
        <main class="flex-1 min-h-0">
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
