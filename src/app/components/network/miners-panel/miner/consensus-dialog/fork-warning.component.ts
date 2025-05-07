import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-fork-warning',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="type === 'soft'"
      class="mt-2 p-2 bg-yellow-900/50 border border-yellow-700 rounded text-xs text-yellow-400"
    >
      <p class="font-semibold">⚠️ Soft Fork Detectado</p>
      <p class="mt-1">
        Esta alteração é compatível com a rede atual. Outros miners podem
        continuar operando normalmente, mesmo com configurações diferentes.
      </p>
    </div>
    <div
      *ngIf="type === 'hard'"
      class="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-400"
    >
      <p class="font-semibold">⚠️ Hard Fork Detectado</p>
      <p class="mt-1">
        Esta alteração pode causar incompatibilidade com a rede atual. Outros
        miners com configurações diferentes não conseguirão validar seus blocos.
      </p>
    </div>
  `,
})
export class ForkWarningComponent {
  @Input() type: 'soft' | 'hard' | 'none' = 'none';
}
