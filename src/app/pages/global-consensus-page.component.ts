import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import {
  ConsensusParameters,
  ConsensusVersion,
  IConsensusParameters,
  DEFAULT_CONSENSUS,
} from '../models/consensus.model';
import { Node } from '../models/node';
import { ConsensusService } from '../services/consensus.service';
import { BitcoinNetworkService } from '../services/bitcoin-network.service';
import { ForkWarningComponent } from '../components/network/miners-panel/miner/consensus-dialog/fork-warning.component';

type ForkType = 'none' | 'soft' | 'hard';

@Component({
  selector: 'app-global-consensus-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    ForkWarningComponent,
    MessageModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <div class="w-full h-full flex flex-col bg-zinc-950">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900"
      >
        <h1 class="text-2xl font-bold text-blue-400">Consenso Global</h1>
        <button
          class="text-zinc-400 hover:text-zinc-200 transition px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700"
          (click)="goBack()"
        >
          Voltar
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 p-6 space-y-4 overflow-y-auto">
        <div class="max-w-4xl mx-auto space-y-6">
          <div *ngIf="mode === 'creating'" class="flex items-center gap-2">
            <h3 class="text-lg font-semibold text-blue-400">
              {{ isEditingFutureEpoch ? 'Editando versão' : 'Nova versão' }}
              <span class="text-xs text-zinc-400 ml-2 italic"
                >(baseada em v{{ selected.version }})</span
              >
            </h3>
            <!-- Editando nova versão local -->
            <div
              *ngIf="isEditingFutureEpoch"
              class="mb-2 p-2 rounded bg-blue-900/40 border border-blue-700 text-blue-200 text-sm"
            >
              Editando época futura já programada para altura {{ startHeight }}.
            </div>
          </div>

          <!-- Versão do Consenso -->
          <div *ngIf="mode !== 'creating'">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-zinc-400">
                Versão do Consenso
              </label>
              <div class="flex items-center gap-2">
                <ng-container
                  *ngIf="
                    selected &&
                      futureInfoByVersion[selected.hash]?.nextFutureEpochHeight;
                    else criarNovaVersao
                  "
                >
                  <button
                    type="button"
                    class="text-blue-500 hover:text-blue-700 hover:underline transition text-xs font-medium px-1 py-0.5 rounded focus:outline-none focus:underline"
                    (click)="startEditing()"
                    aria-label="Editar versão de consenso"
                    title="Editar versão de consenso"
                  >
                    Editar versão
                  </button>
                </ng-container>
                <ng-template #criarNovaVersao>
                  <button
                    type="button"
                    class="text-blue-500 hover:text-blue-700 hover:underline transition text-xs font-medium px-1 py-0.5 rounded focus:outline-none focus:underline"
                    (click)="startEditing()"
                    aria-label="Criar nova versão de consenso"
                    title="Criar nova versão de consenso"
                  >
                    Criar nova versão
                  </button>
                </ng-template>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <p-select
                  [options]="items"
                  [(ngModel)]="selected"
                  (onChange)="onVersionSelect($event)"
                  optionLabel="version"
                  dataKey="hash"
                  class="w-full bg-zinc-900 border border-zinc-700"
                >
                  <!-- Selecionado -->
                  <ng-template #selectedItem let-selectedOption>
                    <div class="flex items-center">
                      <span class="text-white"
                        >v{{ selectedOption.version }}</span
                      >
                      <span
                        *ngIf="
                          futureInfoByVersion[selectedOption.hash]
                            ?.nextFutureEpochHeight
                        "
                        class="ml-2 text-yellow-400 text-xs flex items-center"
                        title="Possui parâmetros futuros"
                      >
                        ⏳ Mudança programada para altura
                        {{
                          futureInfoByVersion[selectedOption.hash]
                            .nextFutureEpochHeight
                        }}
                        <em
                          *ngIf="
                            futureInfoByVersion[selectedOption.hash].blocksToGo
                          "
                          class="ml-1 text-xs text-yellow-200 italic"
                        >
                          (Faltam
                          {{
                            futureInfoByVersion[selectedOption.hash].blocksToGo
                          }}
                          blocos)
                        </em>
                      </span>
                    </div>
                  </ng-template>

                  <!-- Item da lista -->
                  <ng-template let-consensus pTemplate="item">
                    <div class="flex items-center">
                      <span class="text-white">v{{ consensus.version }}</span>
                      <span
                        *ngIf="
                          futureInfoByVersion[consensus.hash]
                            ?.nextFutureEpochHeight
                        "
                        class="ml-2 text-yellow-400 text-xs flex items-center"
                        title="Possui parâmetros futuros"
                      >
                        ⏳ Mudança programada para altura
                        {{
                          futureInfoByVersion[consensus.hash]
                            .nextFutureEpochHeight
                        }}
                        <em
                          *ngIf="futureInfoByVersion[consensus.hash].blocksToGo"
                          class="ml-1 text-xs text-yellow-200 italic"
                        >
                          (Faltam
                          {{ futureInfoByVersion[consensus.hash].blocksToGo }}
                          blocos)
                        </em>
                      </span>
                    </div>
                  </ng-template>
                </p-select>
              </div>
              <p class="mt-1 text-xs text-zinc-500">
                Versão das regras de consenso (atualizada automaticamente)
              </p>
            </div>
          </div>

          <!-- Parâmetros de Consenso -->
          <div class="space-y-4">
            <!-- Opção de Aplicação -->
            <div *ngIf="mode === 'creating'" class="mb-4">
              <div class="flex items-baseline gap-2">
                <span class="text-sm font-medium text-zinc-400"
                  >Aplicar Parâmetros</span
                >
              </div>
              <div class="flex flex-col gap-2 mt-1">
                <label class="inline-flex items-center">
                  <input
                    type="radio"
                    [(ngModel)]="applyImmediately"
                    [value]="true"
                    class="form-radio text-blue-500"
                    (ngModelChange)="onApplyImmediatelyChange()"
                  />
                  <span class="ml-2 text-zinc-100"
                    >Aplicar imediatamente (altura {{ currentHeight }})</span
                  >
                </label>
                <label class="inline-flex items-center">
                  <input
                    type="radio"
                    [(ngModel)]="applyImmediately"
                    [value]="false"
                    class="form-radio text-blue-500"
                    (ngModelChange)="onApplyImmediatelyChange()"
                  />
                  <span class="ml-2 text-zinc-100"
                    >Definir altura específica</span
                  >
                  <label
                    class="text-sm text-zinc-400 ml-2 mr-2"
                    for="alturaInput"
                    >Altura</label
                  >
                  <input
                    id="alturaInput"
                    type="number"
                    [(ngModel)]="startHeight"
                    [min]="currentHeight"
                    (ngModelChange)="onStartHeightChange($event)"
                    class="w-24 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:border-zinc-700 disabled:text-zinc-500 disabled:placeholder-zinc-500 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-500 disabled:hover:opacity-50"
                    placeholder="Altura"
                    [disabled]="applyImmediately"
                  />
                </label>
              </div>
              <p class="mt-1 text-xs text-zinc-500">
                Altura atual: {{ currentHeight }}
                <span *ngIf="blocksToTarget !== null">
                  &nbsp;|&nbsp;Faltam {{ blocksToTarget }} blocos para atingir a
                  altura
                </span>
              </p>
            </div>

            <!-- Intervalo de Ajuste de Dificuldade -->
            <div class="mb-4 flex items-baseline gap-2">
              <span class="text-sm font-medium text-zinc-400 w-64"
                >Intervalo de Ajuste de Dificuldade</span
              >
              <ng-container *ngIf="mode === 'creating'; else exibeIntervalo">
                <input
                  type="number"
                  [(ngModel)]="newParams.difficultyAdjustmentInterval"
                  (ngModelChange)="onIntervalChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  min="1"
                />
              </ng-container>
              <ng-template #exibeIntervalo>
                <span class="text-lg font-semibold text-zinc-100 font-mono">{{
                  paramsOnView?.difficultyAdjustmentInterval
                }}</span>
                <ng-container
                  *ngIf="
                    futureOnView &&
                    paramsOnView?.difficultyAdjustmentInterval !==
                      futureParamsOnView?.difficultyAdjustmentInterval
                  "
                >
                  <span class="mx-1 text-zinc-400 text-lg">➔</span>
                  <span class="font-bold text-green-300 text-lg font-mono">{{
                    futureParamsOnView?.difficultyAdjustmentInterval
                  }}</span>
                  <span
                    class="ml-1 text-yellow-400"
                    title="Mudança programada para altura {{
                      futureOnView.startHeight
                    }} (faltam {{
                      futureOnView.startHeight - currentHeight
                    }} blocos)"
                    >⏳</span
                  >
                </ng-container>
              </ng-template>
              <span class="text-sm text-zinc-400 ml-2">blocos</span>
            </div>

            <!-- Intervalo de Halving -->
            <div class="mb-4 flex items-baseline gap-2">
              <span class="text-sm font-medium text-zinc-400 w-64"
                >Intervalo de Halving</span
              >
              <ng-container
                *ngIf="mode === 'creating'; else showHalvingInterval"
              >
                <input
                  type="number"
                  [(ngModel)]="newParams.halvingInterval"
                  (ngModelChange)="onHalvingIntervalChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  min="1"
                />
              </ng-container>
              <ng-template #showHalvingInterval>
                <span class="text-lg font-semibold text-zinc-100 font-mono">{{
                  paramsOnView?.halvingInterval
                }}</span>
                <ng-container
                  *ngIf="
                    futureOnView &&
                    paramsOnView?.halvingInterval !==
                      futureParamsOnView?.halvingInterval
                  "
                >
                  <span class="mx-1 text-zinc-400 text-lg">➔</span>
                  <span class="font-bold text-green-300 text-lg font-mono">{{
                    futureParamsOnView?.halvingInterval
                  }}</span>
                  <span
                    class="ml-1 text-yellow-400"
                    title="Mudança programada para altura {{
                      futureOnView.startHeight
                    }} (faltam {{
                      futureOnView.startHeight - currentHeight
                    }} blocos)"
                    >⏳</span
                  >
                </ng-container>
              </ng-template>
              <span class="text-sm text-zinc-400 ml-2">blocos</span>
            </div>

            <!-- Máximo de Transações por Bloco -->
            <div class="mb-4 flex items-baseline gap-2">
              <span class="text-sm font-medium text-zinc-400 w-64"
                >Máximo de Transações por Bloco</span
              >
              <ng-container *ngIf="mode === 'creating'; else exibeTx">
                <input
                  type="number"
                  [(ngModel)]="newParams.maxTransactionsPerBlock"
                  (ngModelChange)="onMaxTransactionsChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  min="0"
                />
              </ng-container>
              <ng-template #exibeTx>
                <span class="text-lg font-semibold text-zinc-100 font-mono">{{
                  paramsOnView?.maxTransactionsPerBlock
                }}</span>
                <ng-container
                  *ngIf="
                    futureOnView &&
                    paramsOnView?.maxTransactionsPerBlock !==
                      futureParamsOnView?.maxTransactionsPerBlock
                  "
                >
                  <span class="mx-1 text-zinc-400 text-lg">➔</span>
                  <span class="font-bold text-green-300 text-lg font-mono">{{
                    futureParamsOnView?.maxTransactionsPerBlock
                  }}</span>
                  <span
                    class="ml-1 text-yellow-400"
                    title="Mudança programada para altura {{
                      futureOnView.startHeight
                    }} (faltam {{
                      futureOnView.startHeight - currentHeight
                    }} blocos)"
                    >⏳</span
                  >
                </ng-container>
              </ng-template>
              <span class="text-sm text-zinc-400 ml-2">transações</span>
              <span class="text-xs text-zinc-400 ml-2 italic">
                (0 = sem limite)</span
              >
            </div>

            <!-- Tamanho Máximo do Bloco -->
            <div class="mb-4 flex items-baseline gap-2">
              <span class="text-sm font-medium text-zinc-400 w-64"
                >Tamanho Máximo do Bloco</span
              >
              <ng-container *ngIf="mode === 'creating'; else exibeBloco">
                <input
                  type="number"
                  [(ngModel)]="newParams.maxBlockSize"
                  (ngModelChange)="onMaxBlockSizeChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  min="0.1"
                  step="0.1"
                />
              </ng-container>
              <ng-template #exibeBloco>
                <span class="text-lg font-semibold text-zinc-100 font-mono">{{
                  paramsOnView?.maxBlockSize
                }}</span>
                <ng-container
                  *ngIf="
                    futureOnView &&
                    paramsOnView?.maxBlockSize !==
                      futureParamsOnView?.maxBlockSize
                  "
                >
                  <span class="mx-1 text-zinc-400 text-lg">➔</span>
                  <span class="font-bold text-green-300 text-lg font-mono">{{
                    futureParamsOnView?.maxBlockSize
                  }}</span>
                  <span
                    class="ml-1 text-yellow-400"
                    title="Mudança programada para altura {{
                      futureOnView.startHeight
                    }} (faltam {{
                      futureOnView.startHeight - currentHeight
                    }} blocos)"
                    >⏳</span
                  >
                </ng-container>
              </ng-template>
              <span class="text-sm text-zinc-400 ml-2">MB</span>
            </div>

            <!-- Tempo Alvo de Bloco -->
            <div class="mb-4 flex items-baseline gap-2">
              <span class="text-sm font-medium text-zinc-400 w-64"
                >Tempo Alvo de Bloco</span
              >
              <ng-container *ngIf="mode === 'creating'; else exibeTempo">
                <input
                  type="number"
                  [(ngModel)]="newParams.targetBlockTime"
                  (ngModelChange)="onTargetBlockTimeChange($event)"
                  class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  min="1"
                  step="1"
                />
              </ng-container>
              <ng-template #exibeTempo>
                <span class="text-lg font-semibold text-zinc-100 font-mono">{{
                  paramsOnView?.targetBlockTime
                }}</span>
                <ng-container
                  *ngIf="
                    futureOnView &&
                    paramsOnView?.targetBlockTime !==
                      futureParamsOnView?.targetBlockTime
                  "
                >
                  <span class="mx-1 text-zinc-400 text-lg">➔</span>
                  <span class="font-bold text-green-300 text-lg font-mono">{{
                    futureParamsOnView?.targetBlockTime
                  }}</span>
                  <span
                    class="ml-1 text-yellow-400"
                    title="Mudança programada para altura {{
                      futureOnView.startHeight
                    }} (faltam {{
                      futureOnView.startHeight - currentHeight
                    }} blocos)"
                    >⏳</span
                  >
                </ng-container>
              </ng-template>
              <span class="text-sm text-zinc-400 ml-2">segundos</span>
            </div>
          </div>

          <!-- Última Atualização -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1"
              >Última Atualização</label
            >
            <div class="text-sm text-zinc-300">
              {{ selected.timestamp | date : 'dd/MM/yyyy HH:mm:ss' }}
            </div>
          </div>

          <!-- Altura de Início da Epoca -->
          @if (mode !== 'creating') { @if (futureOnView) {
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1"
              >Início de Vigência</label
            >
            <div class="text-sm text-zinc-300">
              #{{ futureOnView.startHeight }}
              <span class="text-zinc-500 italic"
                >(faltam
                {{ futureOnView.startHeight - currentHeight }} blocos)</span
              >
            </div>
          </div>
          } @else if (selected.startHeight > 0) {
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1"
              >Início de Vigência</label
            >
            <div class="text-sm text-zinc-300">#{{ selected.startHeight }}</div>
          </div>
          } }
        </div>
      </div>

      <!-- Footer -->
      <div
        class="relative flex items-end justify-between gap-6 p-6 border-t border-zinc-700 bg-zinc-900"
      >
        <div>
          <app-fork-warning
            [type]="consolidatedFork.type"
            *ngIf="consolidatedFork.type !== 'none'"
          >
            <div *ngIf="consolidatedFork.params.length > 0" class="mt-1">
              Parâmetros alterados:
              <b>{{ consolidatedFork.params.join(', ') }}</b>
            </div>
          </app-fork-warning>
          <p-message severity="error" *ngIf="error">
            {{ error }}
          </p-message>
        </div>
        <div class="h-full flex items-end gap-3 whitespace-nowrap">
          @switch (mode) { @case ('creating') {
          <button
            class="px-4 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 transition"
            (click)="cancelEdit()"
          >
            Cancelar
          </button>
          <button
            [disabled]="!touched || sameParams"
            class="px-4 py-2 rounded bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white not-disabled:hover:bg-green-700 transition"
            (click)="confirmEdit()"
          >
            {{
              isEditingFutureEpoch
                ? 'Salvar alterações'
                : 'Confirmar nova versão'
            }}
          </button>
          } @case ('confirming') {
          <!-- Mudando versão global para uma versão existente -->
          <button
            class="px-4 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 transition"
            (click)="cancelVersionChange()"
          >
            Cancelar
          </button>
          <button
            class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition"
            (click)="confirmVersionChange()"
          >
            Aplicar para todos os nós
          </button>
          } @case('viewing'){
          <!-- Estado padrão inicial da página -->
          <button
            class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            (click)="goBack()"
          >
            Voltar</button
          >}}
        </div>
      </div>
    </div>

    <p-toast position="bottom-center" />
  `,
})
export class GlobalConsensusPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  isEditing = false;
  touched = false;
  sameParams = false;
  mode: 'creating' | 'confirming' | 'viewing' = 'viewing';
  lastMode: 'creating' | 'confirming' | 'viewing' = 'viewing';
  applyImmediately = true;
  startHeight?: number;
  startHeightCopy?: number;
  currentHeight: number = 0;
  blocksToTarget: number | null = null;

  // Scalable fork warning system
  forkWarnings: { [param: string]: ForkType } = {};
  consolidatedFork: { type: ForkType; params: string[] } = {
    type: 'none',
    params: [],
  };

  error: string | null = null;
  info: string | null = null;

  items: ConsensusVersion[] = [];
  new!: ConsensusVersion;
  newParams!: ConsensusParameters;
  copy!: ConsensusParameters;
  selected!: ConsensusVersion;
  paramsOnView!: IConsensusParameters | null;
  futureParamsOnView!: IConsensusParameters | null;
  futureOnView!: ConsensusVersion | null;

  isEditingFutureEpoch = false;

  public selectedHasFutureEpochs = false;

  public futureInfoByVersion: {
    [hash: string]: {
      nextFutureEpochHeight: number | null;
      blocksToGo: number | null;
    };
  } = {};

  constructor(
    private consensusService: ConsensusService,
    private bitcoinNetwork: BitcoinNetworkService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    // Inicializar a altura atual (maior altura entre todos os mineradores)
    this.currentHeight = this.getGlobalHeight();

    // Inicializar a versão selecionada
    this.selected = this.consensusService.versions[0] || DEFAULT_CONSENSUS;

    // Garantir que selected sempre existe
    if (!this.selected) {
      this.selected = DEFAULT_CONSENSUS;
    }

    // Inicializar paramsOnView
    this.paramsOnView = this.selected.parameters;

    this.new = ConsensusVersion.deepCopy(this.selected);
    this.newParams = ConsensusParameters.deepCopy(this.paramsOnView ?? {});

    // Inicializar copy para comparações de fork
    this.copy = ConsensusParameters.deepCopy(this.paramsOnView ?? {});

    this.clearMessages();

    this.consensusService.versions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((versions) => {
        this.items = versions;
        this.updateView();
      });

    this.updateView();
  }

  getGlobalHeight(): number {
    const miners = this.bitcoinNetwork.nodes.filter(
      (n) => n.nodeType === 'miner'
    );
    return miners
      .map((m) => m.getLatestBlock()?.height || 0)
      .reduce((a, b) => Math.max(a, b), 0);
  }

  goBack() {
    this.router.navigate(['/']);
  }

  startEditing() {
    this.lastMode = this.mode;
    this.mode = 'creating';
    this.isEditing = true;
    this.touched = false;
    this.applyImmediately = true;
    this.isEditingFutureEpoch = false;

    // Definir a altura atual como referência
    this.currentHeight = this.getGlobalHeight();
    this.startHeight = this.currentHeight;
    this.blocksToTarget = null;
    this.updateSelectedFutureEpochsInfo();
    this.updateFutureInfoForItems();

    // Verificar se já existe uma época futura programada
    if (this.selected.startHeight > this.currentHeight) {
      // Entrar em modo de edição da época futura
      this.isEditingFutureEpoch = true;
      this.startHeight = this.selected.startHeight;
      this.newParams = ConsensusParameters.deepCopy(this.selected.parameters);
      this.applyImmediately = false;
    } else {
      // Criar uma nova versão com base nos parâmetros atuais da versão selecionada
      this.new = ConsensusVersion.deepCopy(this.selected);
      this.newParams = ConsensusParameters.deepCopy(this.paramsOnView ?? {});
    }

    // Fazer uma cópia dos parâmetros atuais para poder restaurar caso necessário
    this.copy = ConsensusParameters.deepCopy(this.paramsOnView ?? {});
    this.startHeightCopy = this.startHeight;

    // Limpar mensagens de erro e sucesso
    this.clearMessages();
  }

  onApplyImmediatelyChange() {
    if (this.applyImmediately) {
      this.startHeight = this.currentHeight;
    } else {
      // Se estiver editando época futura, mantém o valor dela
      if (this.isEditingFutureEpoch) {
        this.startHeight = this.selected.startHeight;
      } else {
        this.startHeight = this.currentHeight;
      }
    }
    this.onStartHeightChange(this.startHeight!);

    this.onParametersChange();
  }

  onStartHeightChange(value: number) {
    this.updateBlocksToTarget(value);
    this.onParametersChange();
  }

  onIntervalChange(value: number) {
    if (!isNaN(value) && value > 0) {
      this.forkWarnings['difficultyAdjustmentInterval'] =
        value !== this.copy.difficultyAdjustmentInterval ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onMaxTransactionsChange(value: number) {
    if (!isNaN(value) && value >= 0) {
      this.forkWarnings['maxTransactionsPerBlock'] =
        value !== this.copy.maxTransactionsPerBlock ? 'soft' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onMaxBlockSizeChange(value: number) {
    if (!isNaN(value) && value > 0) {
      if (value < this.copy.maxBlockSize) {
        this.forkWarnings['maxBlockSize'] = 'soft';
      } else if (value > this.copy.maxBlockSize) {
        this.forkWarnings['maxBlockSize'] = 'hard';
      } else {
        this.forkWarnings['maxBlockSize'] = 'none';
      }
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onTargetBlockTimeChange(value: number) {
    if (!isNaN(value) && value > 0) {
      this.forkWarnings['targetBlockTime'] =
        value !== this.copy.targetBlockTime ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onHalvingIntervalChange(value: number) {
    if (!isNaN(value) && value > 0) {
      this.forkWarnings['halvingInterval'] =
        value !== this.copy.halvingInterval ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  confirmEdit() {
    // Se for edição de época futura, apenas atualiza os parâmetros dessa época
    if (this.isEditingFutureEpoch) {
      if (
        this.startHeight === undefined ||
        this.startHeight < this.currentHeight
      ) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: `A altura de início deve ser no mínimo ${this.currentHeight}`,
        });
        return;
      }

      // Atualizar época futura
      const params = ConsensusParameters.deepCopy(this.newParams);
      params.calculateHash();

      this.selected.parameters = params;
      this.selected.startHeight = this.startHeight;
      this.consensusService.updateConsensus(this.selected);
      this.mode = this.lastMode;
      this.isEditing = false;
      this.isEditingFutureEpoch = false;
      this.messageService.add({
        severity: 'success',
        summary: 'Parâmetros atualizados',
        detail: `Os parâmetros da época futura foram atualizados para a altura ${this.startHeight}.`,
        life: 6000,
      });
      this.clearMessages();
      this.updateView();

      return;
    }

    // Se não for aplicar imediatamente, validar a altura
    if (!this.applyImmediately) {
      if (
        this.startHeight === undefined ||
        this.startHeight < this.currentHeight
      ) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: `A altura de início deve ser no mínimo ${this.currentHeight}`,
        });
        return;
      }
    }

    const success = this.publishVersion();

    if (success) {
      this.selected = this.items.find((v) => v.hash === this.new.hash)!;
      this.mode = 'confirming';
      this.clearMessages();
      this.updateView();
    }
  }

  onVersionSelect(event: any) {
    this.clearMessages();

    if (event.value) {
      const selected = event.value as ConsensusVersion;
      if (selected.version !== this.selected.version) {
        this.mode = 'confirming';
      } else {
        this.mode = 'viewing';
      }
    }

    this.updateView();
  }

  confirmVersionChange() {
    // Aplicar a versão selecionada para todos os mineradores
    const miners = this.bitcoinNetwork.nodes.filter(
      (n) => n.nodeType === 'miner'
    );
    miners.forEach((miner) => {
      miner.changeConsensus(this.selected);
    });

    this.mode = 'viewing';
    this.clearMessages();
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: `Versão v${this.selected.version} aplicada para todos os ${miners.length} mineradores.`,
      life: 6000,
    });
    this.updateView();
  }

  publishVersion() {
    const success = this.consensusService.publishConsensus(this.new);

    if (!success) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao publicar versão na rede. Tente novamente.',
        life: 6000,
      });
      return false;
    }

    this.messageService.add({
      severity: 'success',
      summary: `Versão v${this.new.version} criada e publicada na rede.`,
      detail: 'Você e outros nodes poderão atualizar para a nova versão.',
      life: 6000,
    });

    return true;
  }

  isParamInFork(param: string): boolean {
    return this.consolidatedFork.params.includes(param);
  }

  cancelEdit() {
    this.mode = this.lastMode;
    this.isEditing = false;
    this.paramsOnView = ConsensusParameters.deepCopy(this.copy);
    this.clearMessages();
    this.updateView();
  }

  cancelVersionChange() {
    this.mode = 'viewing';
    this.paramsOnView = ConsensusParameters.deepCopy(this.copy);
    this.clearMessages();
    this.updateView();
  }

  private prepareNewVersionInstance() {
    const newVersionNumber = this.new.version + 1;

    // Se for aplicar imediatamente, usa a altura atual
    // Se não, usa a altura especificada pelo usuário
    const actualStartHeight = this.applyImmediately
      ? this.currentHeight
      : this.startHeight ?? this.currentHeight;

    const params = ConsensusParameters.deepCopy(this.newParams);
    params.calculateHash();

    this.new = new ConsensusVersion({
      version: newVersionNumber,
      timestamp: Date.now(),
      startHeight: actualStartHeight,
      parameters: params,
      previousVersion: this.selected,
    });

    this.new.calculateHash();
  }

  private clearMessages() {
    this.error = null;
    this.info = null;
    this.forkWarnings = {};
    this.updateConsolidatedFork();
  }

  private updateConsolidatedFork() {
    const warnings = Object.entries(this.forkWarnings).filter(
      ([_, type]) => type !== 'none'
    );

    if (warnings.length === 0) {
      this.consolidatedFork = { type: 'none', params: [] };
      return;
    }

    const hasHardFork = warnings.some(([_, type]) => type === 'hard');
    this.consolidatedFork = {
      type: hasHardFork ? 'hard' : 'soft',
      params: warnings.map(([param]) => param),
    };
  }

  private onParametersChange() {
    this.newParams.calculateHash();

    this.touched = true;
    this.sameParams = this.isEditingFutureEpoch
      ? this.newParams.hash === this.copy.hash &&
        this.startHeight === this.startHeightCopy
      : this.newParams.hash === this.copy.hash;

    this.prepareNewVersionInstance();
    this.updateView();
  }

  private updateBlocksToTarget(value?: number) {
    if (typeof value === 'number' && value > this.currentHeight) {
      this.blocksToTarget = value - this.currentHeight;
    } else {
      this.blocksToTarget = null;
    }
  }

  private updateSelectedFutureEpochsInfo() {
    if (!this.selected) {
      this.selectedHasFutureEpochs = false;
      return;
    }
    const future = this.selected.startHeight > this.currentHeight;
    this.selectedHasFutureEpochs = future;
  }

  private updateFutureInfoForItems() {
    this.futureInfoByVersion = {};
    for (const v of this.items) {
      const future = v.startHeight > this.currentHeight;
      const next = future ? v.startHeight : null;
      this.futureInfoByVersion[v.hash] = {
        nextFutureEpochHeight: next,
        blocksToGo:
          next && next > this.currentHeight ? next - this.currentHeight : null,
      };
    }
  }

  private updateParamsOnView() {
    this.futureOnView =
      this.selected.startHeight > this.currentHeight ? this.selected : null;
    this.futureParamsOnView = this.futureOnView?.parameters ?? null;
    this.paramsOnView = this.futureOnView
      ? this.selected.previousVersion?.parameters ?? null
      : this.selected.parameters;
  }

  private updateView() {
    this.updateParamsOnView();
    this.updateSelectedFutureEpochsInfo();
    this.updateFutureInfoForItems();
    this.updateBlocksToTarget(
      this.applyImmediately ? undefined : this.startHeight
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
