import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

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
      <a
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded text-lg transition flex items-center gap-2"
        routerLink="/network"
      >
        <i class="pi pi-plus"></i>
        Criar meu primeiro nó
      </a>
    </div>
  `,
})
export class HomePageComponent {}
