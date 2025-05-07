import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ConsensusParameters,
  DEFAULT_CONSENSUS,
} from '../../../../../models/consensus.model';

@Component({
  selector: 'app-consensus-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <!-- Header -->
        <div
          class="flex items-center justify-between p-6 border-b border-zinc-700"
        >
          <h3 class="text-lg font-semibold text-blue-400">
            Parâmetros de Consenso
          </h3>
          <button
            class="text-zinc-400 hover:text-zinc-200 transition"
            (click)="close.emit()"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <div class="space-y-4">
            <!-- Intervalo de Ajuste -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">
                Intervalo de Ajuste de Dificuldade
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  [value]="editingParams.difficultyAdjustmentInterval"
                  [disabled]="!isEditing"
                  (input)="onIntervalChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  min="1"
                />
                <span class="text-sm text-zinc-400">blocos</span>
              </div>
              <p class="mt-1 text-xs text-zinc-500">
                Número de blocos entre cada ajuste de dificuldade
              </p>
            </div>

            <!-- Máximo de Transações -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">
                Máximo de Transações por Bloco
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  [value]="editingParams.maxTransactionsPerBlock"
                  [disabled]="!isEditing"
                  (input)="onMaxTransactionsChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  min="0"
                />
                <span class="text-sm text-zinc-400">transações</span>
              </div>
              <p class="mt-1 text-xs text-zinc-500">
                Limite de transações por bloco (0 = sem limite)
              </p>
              <div
                *ngIf="showSoftForkWarning"
                class="mt-2 p-2 bg-yellow-900/50 border border-yellow-700 rounded text-xs text-yellow-400"
              >
                <p class="font-semibold">⚠️ Soft Fork Detectado</p>
                <p class="mt-1">
                  Esta alteração é compatível com a rede atual. Outros miners
                  podem continuar operando normalmente, mesmo com configurações
                  diferentes.
                </p>
              </div>
            </div>

            <!-- Tamanho Máximo do Bloco -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">
                Tamanho Máximo do Bloco
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  [value]="editingParams.maxBlockSize"
                  [disabled]="!isEditing"
                  (input)="onMaxBlockSizeChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  min="1"
                />
                <span class="text-sm text-zinc-400">MB</span>
              </div>
              <p class="mt-1 text-xs text-zinc-500">
                Tamanho máximo do bloco em megabytes
              </p>
              <div
                *ngIf="showHardForkWarning"
                class="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-400"
              >
                <p class="font-semibold">⚠️ Hard Fork Detectado</p>
                <p class="mt-1">
                  Esta alteração pode causar incompatibilidade com a rede atual.
                  Outros miners com configurações diferentes não conseguirão
                  validar seus blocos.
                </p>
              </div>
            </div>

            <!-- Versão do Consenso -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">
                Versão do Consenso
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  [value]="editingParams.consensusVersion"
                  disabled
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white opacity-50"
                />
              </div>
              <p class="mt-1 text-xs text-zinc-500">
                Versão das regras de consenso (atualizada automaticamente)
              </p>
            </div>

            <!-- Última Atualização -->
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">
                Última Atualização
              </label>
              <div class="text-sm text-zinc-300">
                {{ editingParams.timestamp | date : 'dd/MM/yyyy HH:mm:ss' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-end gap-2 p-6 border-t border-zinc-700"
        >
          <button
            *ngIf="isEditing"
            class="px-4 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 transition"
            (click)="cancelEdit()"
          >
            Cancelar
          </button>
          <button
            *ngIf="!isEditing"
            class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            (click)="startEditing()"
          >
            Editar
          </button>
          <button
            *ngIf="isEditing"
            class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition"
            (click)="saveChanges()"
          >
            Salvar
          </button>
          <button
            *ngIf="!isEditing"
            class="px-4 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 transition"
            (click)="close.emit()"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ConsensusDialogComponent {
  @Input() consensus!: ConsensusParameters;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<ConsensusParameters>();

  isEditing = false;
  editingParams: ConsensusParameters = { ...DEFAULT_CONSENSUS };
  private originalParams: ConsensusParameters = { ...DEFAULT_CONSENSUS };
  showSoftForkWarning = false;
  showHardForkWarning = false;

  ngOnInit() {
    this.editingParams = { ...this.consensus };
    this.originalParams = { ...this.consensus };
  }

  startEditing() {
    this.isEditing = true;
    this.originalParams = { ...this.editingParams };
    this.showSoftForkWarning = false;
    this.showHardForkWarning = false;
  }

  cancelEdit() {
    this.editingParams = { ...this.consensus };
    this.isEditing = false;
    this.showSoftForkWarning = false;
    this.showHardForkWarning = false;
  }

  saveChanges() {
    // Verifica se houve mudança no tamanho do bloco (Hard Fork)
    if (this.editingParams.maxBlockSize !== this.originalParams.maxBlockSize) {
      this.incrementMajorVersion();
    }
    // Verifica se houve mudança no número de transações (Soft Fork)
    else if (
      this.editingParams.maxTransactionsPerBlock !==
      this.originalParams.maxTransactionsPerBlock
    ) {
      this.incrementMinorVersion();
    }
    // Verifica se houve mudança no intervalo de ajuste
    else if (
      this.editingParams.difficultyAdjustmentInterval !==
      this.originalParams.difficultyAdjustmentInterval
    ) {
      this.incrementPatchVersion();
    }

    this.save.emit(this.editingParams);
    this.isEditing = false;
    this.showSoftForkWarning = false;
    this.showHardForkWarning = false;
  }

  onIntervalChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingParams.difficultyAdjustmentInterval = value;
    }
  }

  onMaxTransactionsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value >= 0) {
      this.editingParams.maxTransactionsPerBlock = value;
      this.showSoftForkWarning =
        value !== this.originalParams.maxTransactionsPerBlock;
      this.showHardForkWarning = false;
    }
  }

  onMaxBlockSizeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingParams.maxBlockSize = value;
      this.showHardForkWarning = value !== this.originalParams.maxBlockSize;
      this.showSoftForkWarning = false;
    }
  }

  private incrementMajorVersion() {
    const versionParts = this.editingParams.consensusVersion.split('.');
    versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
    versionParts[1] = '0';
    versionParts[2] = '0';
    this.editingParams.consensusVersion = versionParts.join('.');
  }

  private incrementMinorVersion() {
    const versionParts = this.editingParams.consensusVersion.split('.');
    versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
    versionParts[2] = '0';
    this.editingParams.consensusVersion = versionParts.join('.');
  }

  private incrementPatchVersion() {
    const versionParts = this.editingParams.consensusVersion.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    this.editingParams.consensusVersion = versionParts.join('.');
  }
}
