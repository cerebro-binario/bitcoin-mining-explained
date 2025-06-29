import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MinersStats } from '../miners-panel/miners-panel.component';

interface HashRateOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex w-full max-w-5xl mx-auto rounded-lg shadow-2xl bg-zinc-900/95 border border-zinc-800 px-6 py-3 items-center justify-between backdrop-blur pointer-events-auto"
    >
      <div class="flex gap-3">
        <button
          class="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 transition"
          (click)="startAll.emit()"
        >
          Iniciar Todos ({{ stats.nCanStart }})
        </button>
        <button
          class="px-4 py-2 rounded bg-yellow-600 text-white font-semibold hover:bg-yellow-700 transition"
          (click)="pauseAll.emit()"
        >
          Pausar Todos ({{ stats.nCanPause }})
        </button>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-zinc-400"
          >Hash Rate Global:
          <span class="font-bold text-blue-400">{{
            stats.totalHashRate | number
          }}</span>
          H/s</span
        >
        <span class="text-xs text-zinc-400">Hash Rate Padrão:</span>
        <ng-container *ngFor="let rate of hashRateOptions">
          <button
            class="px-2 py-1 rounded text-xs font-semibold transition"
            [ngClass]="{
              'bg-blue-600 text-white': stats.defaultHashRate === rate.value,
              'bg-zinc-700 text-zinc-300 hover:bg-zinc-600':
                stats.defaultHashRate !== rate.value
            }"
            (click)="setDefaultHashRate.emit(rate.value)"
            [title]="rate.label"
          >
            {{ rate.label }}
          </button>
        </ng-container>
      </div>
    </div>
  `,
})
export class ControlPanelComponent {
  @Input() stats!: MinersStats;
  @Input() hashRateOptions: HashRateOption[] = [];
  @Output() startAll = new EventEmitter<void>();
  @Output() pauseAll = new EventEmitter<void>();
  @Output() setDefaultHashRate = new EventEmitter<number | null>();
}
