import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { BitcoinNetworkService } from '../../services/bitcoin-network.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div
      class="flex flex-col items-center justify-center h-full text-center px-4 py-16"
    >
      <i class="pi pi-bitcoin text-6xl text-blue-400 mb-4"></i>
      <h1 class="text-4xl font-bold mb-2">Bitcoin Mining Explained</h1>
      <p class="text-lg text-zinc-300 mb-6 max-w-xl">
        Bem-vindo ao simulador didático de mineração e rede Bitcoin!<br />
        Visualize, crie e interaja com uma blockchain de forma intuitiva e
        visual.
      </p>
      <div class="mb-4">
        <span class="inline-block bg-zinc-800 text-zinc-400 px-4 py-2 rounded">
          Nenhum nó selecionado. Crie um nó para começar!
        </span>
      </div>
      <div class="flex gap-4">
        <button
          (click)="addAndGo('miner')"
          class="bg-blue-500/90 hover:bg-blue-600 text-white rounded-xl px-6 py-3 text-lg font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-300/40"
        >
          <span class="text-sm text-white/70 align-middle">+</span>
          <i class="pi pi-cog text-xl opacity-80 ml-1"></i>
          Minerador
        </button>
        <button
          (click)="addAndGo('peer')"
          class="bg-green-500/90 hover:bg-green-600 text-white rounded-xl px-6 py-3 text-lg font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-300/40"
        >
          <span class="text-sm text-white/70 align-middle">+</span>
          <i class="pi pi-server text-xl opacity-80 ml-1"></i>
          Nó
        </button>
        <button
          (click)="addAndGo('user')"
          class="bg-yellow-400/90 hover:bg-yellow-500 text-zinc-900 rounded-xl px-6 py-3 text-lg font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-300/40"
        >
          <span class="text-sm text-zinc-900/70 align-middle">+</span>
          <i class="pi pi-user text-xl opacity-80 ml-1"></i>
          Usuário
        </button>
      </div>
    </div>
  `,
})
export class HomePageComponent {
  constructor(
    private bitcoinNetwork: BitcoinNetworkService,
    private router: Router
  ) {}

  addAndGo(type: 'miner' | 'peer' | 'user') {
    this.bitcoinNetwork.addNode(type);
  }
}
