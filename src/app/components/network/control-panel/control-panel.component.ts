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
      class="w-full rounded-xl shadow-2xl bg-gradient-to-br from-zinc-900/95 to-zinc-800/90 border border-zinc-700 px-4 py-4 flex flex-col gap-4 pointer-events-auto min-h-0 overflow-hidden min-w-0"
    >
      <!-- Botões principais -->
      <div class="flex gap-3 flex-shrink-0 items-center min-w-0">
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-all duration-200 text-base shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 min-w-0"
          (click)="startAll.emit()"
        >
          <span class="inline-block align-middle">
            <!-- Ícone Play -->
            <svg
              width="18"
              height="18"
              fill="currentColor"
              class="inline-block mr-1"
              viewBox="0 0 20 20"
            >
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          </span>
          Iniciar Todos
          <span
            class="ml-2 bg-white/30 text-white text-xs rounded-full px-2 py-0.5 font-bold flex items-center justify-center min-w-[1.5em]"
            >{{ stats.nCanStart }}</span
          >
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 text-white font-semibold hover:bg-yellow-500 transition-all duration-200 text-base shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-0"
          (click)="pauseAll.emit()"
        >
          <span class="inline-block align-middle">
            <!-- Ícone Pause -->
            <svg
              width="18"
              height="18"
              fill="currentColor"
              class="inline-block mr-1"
              viewBox="0 0 20 20"
            >
              <rect x="4" y="4" width="4" height="12" rx="1" />
              <rect x="12" y="4" width="4" height="12" rx="1" />
            </svg>
          </span>
          Pausar Todos
          <span
            class="ml-2 bg-white/30 text-white text-xs rounded-full px-2 py-0.5 font-bold flex items-center justify-center min-w-[1.5em]"
            >{{ stats.nCanPause }}</span
          >
        </button>
      </div>
      <!-- Grupo de informações -->
      <div class="flex flex-col gap-3 min-w-0">
        <div class="flex items-baseline gap-2 min-h-0 min-w-0 flex-wrap">
          <span class="text-sm text-zinc-300 font-semibold"
            >Hash Rate Global:</span
          >
          <span
            class="font-bold text-blue-400 text-lg tabular-nums text-right"
            >{{ stats.totalHashRate | number }}</span
          >
          <span class="text-xs text-zinc-400">H/s</span>
        </div>
        <div
          class="flex flex-col gap-2 bg-zinc-800/70 border border-zinc-700 rounded-lg px-3 py-2"
        >
          <span class="text-sm text-zinc-300 font-semibold mb-1"
            >Hash Rate Padrão:</span
          >
          <div class="flex flex-wrap gap-2 min-h-0 min-w-0">
            <ng-container *ngFor="let rate of hashRateOptions">
              <button
                class="flex items-center gap-1 px-3 py-1 rounded-md text-sm font-semibold transition-all duration-200 h-8 min-h-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
                [ngClass]="{
                  'bg-blue-600 text-white':
                    stats.defaultHashRate === rate.value,
                  'bg-zinc-700 text-zinc-300 hover:bg-zinc-600':
                    stats.defaultHashRate !== rate.value
                }"
                (click)="setDefaultHashRate.emit(rate.value)"
                [title]="rate.label"
              >
                <!-- Ícone de velocidade -->
                <svg
                  *ngIf="rate.value !== null"
                  width="15"
                  height="15"
                  fill="currentColor"
                  class="inline-block"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M13.293 2.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-9.5 9.5a1 1 0 01-.325.217l-5 2a1 1 0 01-1.302-1.302l2-5a1 1 0 01.217-.325l9.5-9.5z"
                  ></path>
                </svg>
                {{ rate.label }}
              </button>
            </ng-container>
          </div>
        </div>
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
