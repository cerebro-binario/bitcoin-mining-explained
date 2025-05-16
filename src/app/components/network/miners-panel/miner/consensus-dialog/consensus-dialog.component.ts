import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import {
  ConsensusEpoch,
  ConsensusParameters,
  ConsensusVersion,
  IConsensusEpoch,
  IConsensusParameters,
} from '../../../../../models/consensus.model';
import { Node } from '../../../../../models/node';
import { ConsensusService } from '../../../../../services/consensus.service';
import { ForkWarningComponent } from './fork-warning.component';

type ForkType = 'none' | 'soft' | 'hard';

@Component({
  selector: 'app-consensus-dialog',
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
  templateUrl: './consensus-dialog.component.html',
  styleUrls: ['./consensus-dialog.component.scss'],
})
export class ConsensusDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private startHeightInput$ = new Subject<number>();

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
  paramsOnView!: IConsensusParameters;
  epochOnView!: ConsensusEpoch;

  @Input() miner!: Node;

  @Output() close = new EventEmitter<void>();
  @Output() versionChange = new EventEmitter<void>();

  isEditingFutureEpoch = false;
  futureEpochIndex: number | null = null;

  public selectedHasFutureEpochs = false;
  public selectedNextFutureEpochHeight: number | null = null;

  public futureInfoByVersion: {
    [hash: string]: {
      nextFutureEpochHeight: number | null;
      blocksToGo: number | null;
    };
  } = {};

  constructor(
    private consensusService: ConsensusService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    // Inicializar a versão selecionada com a versão rodando no miner
    this.selected = this.miner.consensus;
    this.epochOnView = this.selected.epochs[this.selected.epochs.length - 1];
    this.paramsOnView = this.epochOnView.parameters;

    // Inicializar a versão nova com base na versão selecionada
    this.new = ConsensusVersion.deepCopy(this.selected);
    this.newParams = ConsensusParameters.deepCopy(this.paramsOnView);

    this.clearMessages();

    this.consensusService.versions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((versions) => {
        this.items = versions;
      });

    // Debounce para dica de blocos restantes
    this.startHeightInput$
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'number' && value > this.currentHeight) {
          this.blocksToTarget = value - this.currentHeight;
        } else {
          this.blocksToTarget = null;
        }
      });

    this.updateSelectedFutureEpochsInfo();
    this.updateFutureInfoForItems();
  }

  startEditing() {
    this.lastMode = this.mode;
    this.mode = 'creating';
    this.isEditing = true;
    this.touched = false;
    this.applyImmediately = true;
    this.isEditingFutureEpoch = false;
    this.futureEpochIndex = null;

    // Definir a altura atual como referência
    this.currentHeight = this.miner.getLatestBlock()?.height || 0;
    this.startHeight = this.currentHeight;
    this.blocksToTarget = null;
    this.updateSelectedFutureEpochsInfo();
    this.updateFutureInfoForItems();

    // Verificar se já existe uma época futura programada
    const futureEpochIdx = this.selected.epochs.findIndex(
      (e) => e.startHeight > this.currentHeight
    );
    if (futureEpochIdx !== -1) {
      // Entrar em modo de edição da época futura
      this.isEditingFutureEpoch = true;
      this.futureEpochIndex = futureEpochIdx;
      const futureEpoch = this.selected.epochs[futureEpochIdx];
      this.startHeight = futureEpoch.startHeight;
      this.newParams = ConsensusParameters.deepCopy(futureEpoch.parameters);
      this.applyImmediately = false;
    } else {
      // Criar uma nova versão com base nos parâmetros atuais da versão selecionada
      this.new = ConsensusVersion.deepCopy(this.selected);
      this.newParams = ConsensusParameters.deepCopy(this.paramsOnView);
    }

    // Fazer uma cópia dos parâmetros atuais para poder restaurar caso necessário
    this.copy = ConsensusParameters.deepCopy(this.paramsOnView);
    this.startHeightCopy = this.startHeight;

    // Limpar mensagens de erro e sucesso
    this.clearMessages();
  }

  onStartHeightChange(value: number) {
    this.onParametersChange();
    this.startHeightInput$.next(value);
    this.updateSelectedFutureEpochsInfo();
    this.updateFutureInfoForItems();
  }

  onIntervalChange(value: number) {
    if (!isNaN(value) && value > 0) {
      this.paramsOnView.difficultyAdjustmentInterval = value;
      this.forkWarnings['difficultyAdjustmentInterval'] =
        value !== this.copy.difficultyAdjustmentInterval ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onMaxTransactionsChange(value: number) {
    if (!isNaN(value) && value >= 0) {
      this.paramsOnView.maxTransactionsPerBlock = value;
      this.forkWarnings['maxTransactionsPerBlock'] =
        value !== this.copy.maxTransactionsPerBlock ? 'soft' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onMaxBlockSizeChange(value: number) {
    if (!isNaN(value) && value > 0) {
      this.paramsOnView.maxBlockSize = value;
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
      this.paramsOnView.targetBlockTime = value;
      this.forkWarnings['targetBlockTime'] =
        value !== this.copy.targetBlockTime ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  confirmEdit() {
    // Se for edição de época futura, apenas atualiza os parâmetros dessa época
    if (this.isEditingFutureEpoch && this.futureEpochIndex !== null) {
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

      const updatedEpochs = this.selected.epochs;
      updatedEpochs[this.futureEpochIndex] = {
        ...updatedEpochs[this.futureEpochIndex],
        startHeight: this.startHeight,
        parameters: params,
      };
      this.consensusService.updateConsensus(this.selected);
      this.paramsOnView = ConsensusParameters.deepCopy(params);
      this.mode = this.lastMode;
      this.isEditing = false;
      this.isEditingFutureEpoch = false;
      this.futureEpochIndex = null;
      this.messageService.add({
        severity: 'success',
        summary: 'Parâmetros atualizados',
        detail: `Os parâmetros da época futura foram atualizados para a altura ${this.startHeight}.`,
        life: 6000,
      });
      this.versionChange.emit();
      this.clearMessages();
      this.updateSelectedFutureEpochsInfo();
      this.updateFutureInfoForItems();
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
      this.paramsOnView = ConsensusParameters.deepCopy(
        this.selected.getCurrentConsensusParameters()
      );
      this.mode = 'confirming';
      this.clearMessages();
      this.updateSelectedFutureEpochsInfo();
      this.updateFutureInfoForItems();
    }
  }

  onVersionSelect(event: any) {
    this.clearMessages();

    if (event.value) {
      const selected = event.value as ConsensusVersion;
      this.paramsOnView = ConsensusParameters.deepCopy(
        selected.getCurrentConsensusParameters()
      );
      this.updateSelectedFutureEpochsInfo();
      this.updateFutureInfoForItems();
      if (selected.version !== this.miner.consensus.version) {
        this.mode = 'confirming';
      } else {
        this.mode = 'viewing';
      }
    }
  }

  confirmVersionChange() {
    this.miner.consensus = this.selected;
    this.mode = 'viewing';
    this.clearMessages();
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: `Versão v${this.selected.version} agora está em uso.`,
      life: 6000,
    });
    this.versionChange.emit();
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
  }

  cancelVersionChange() {
    this.mode = 'viewing';
    this.paramsOnView = ConsensusParameters.deepCopy(this.copy);
    this.clearMessages();
  }

  private prepareNewVersionInstance() {
    const newVersion = this.new.version + 1;

    // Se for aplicar imediatamente, usa a altura atual
    // Se não, usa a altura especificada pelo usuário
    const actualStartHeight = this.applyImmediately
      ? this.currentHeight
      : this.startHeight ?? this.currentHeight;

    const params = ConsensusParameters.deepCopy(this.newParams);
    params.calculateHash();

    const newEpoch: IConsensusEpoch = {
      startHeight: actualStartHeight,
      parameters: params,
    };

    const previousEpochs = this.selected.epochs
      .filter(
        (e) =>
          e.startHeight <= this.currentHeight &&
          e.startHeight !== actualStartHeight
      )
      .map((e) => ConsensusEpoch.deepCopy(e));

    this.new = new ConsensusVersion({
      version: newVersion,
      epochs: [...previousEpochs, newEpoch],
    });

    if (previousEpochs.length > 0) {
      const lastEpoch = previousEpochs[previousEpochs.length - 1];
      lastEpoch.endHeight = actualStartHeight - 1;
    }

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
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onApplyImmediatelyChange() {
    if (this.applyImmediately) {
      this.startHeight = this.currentHeight;
    } else {
      // Se estiver editando época futura, mantém o valor dela
      if (this.isEditingFutureEpoch && this.futureEpochIndex !== null) {
        const futureEpoch = this.selected.epochs[this.futureEpochIndex];
        this.startHeight = futureEpoch.startHeight;
      } else {
        this.startHeight = this.currentHeight;
      }
    }
    this.onStartHeightChange(this.startHeight!);
    this.updateSelectedFutureEpochsInfo();
    this.updateFutureInfoForItems();
  }

  private updateSelectedFutureEpochsInfo() {
    if (!this.selected) {
      this.selectedHasFutureEpochs = false;
      this.selectedNextFutureEpochHeight = null;
      return;
    }
    const future = this.selected.epochs
      .filter((e) => e.startHeight > this.currentHeight)
      .map((e) => e.startHeight);
    this.selectedHasFutureEpochs = future.length > 0;
    this.selectedNextFutureEpochHeight = future.length
      ? Math.min(...future)
      : null;
  }

  private updateFutureInfoForItems() {
    this.futureInfoByVersion = {};
    for (const v of this.items) {
      const future = v.epochs
        .filter((e) => e.startHeight > this.currentHeight)
        .map((e) => e.startHeight);
      const next = future.length ? Math.min(...future) : null;
      this.futureInfoByVersion[v.hash] = {
        nextFutureEpochHeight: next,
        blocksToGo:
          next && next > this.currentHeight ? next - this.currentHeight : null,
      };
    }
  }
}
