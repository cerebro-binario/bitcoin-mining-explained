import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-fork-warning',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="type === 'soft' || type === 'hard'"
      [ngClass]="{
        'bg-yellow-900/50 border-yellow-700 text-yellow-400': type === 'soft',
        'bg-red-900/50 border-red-700 text-red-400': type === 'hard'
      }"
      class="mt-2 p-2 border rounded text-xs"
    >
      <p class="font-semibold">
        ⚠️ {{ type === 'soft' ? 'Soft Fork Detectado' : 'Hard Fork Detectado' }}
      </p>
      <p class="mt-1">
        {{
          type === 'soft'
            ? 'Esta alteração é compatível com a rede atual. Outros miners podem continuar operando normalmente, mesmo com configurações diferentes.'
            : 'Esta alteração pode causar incompatibilidade com a rede atual. Outros miners com configurações diferentes não conseguirão validar seus blocos.'
        }}
      </p>
      <ng-content></ng-content>
    </div>
  `,
})
export class ForkWarningComponent {
  @Input() type: 'soft' | 'hard' | 'none' = 'none';
}
