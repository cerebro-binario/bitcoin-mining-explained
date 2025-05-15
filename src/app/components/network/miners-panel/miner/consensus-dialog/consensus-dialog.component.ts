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
import { Subject, takeUntil, debounceTime } from 'rxjs';
import {
  ConsensusEpoch,
  ConsensusParameters,
  ConsensusVersion,
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
  paramChanged = false;
  mode: 'creating' | 'confirming' | 'viewing' = 'viewing';
  applyImmediately = true;
  startHeight?: number;
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
  selectedParams!: ConsensusParameters;
  existing?: ConsensusVersion;

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
    this.selected = new ConsensusVersion({ ...this.miner.consensus });
    this.selectedParams = { ...this.selected.getCurrentConsensusParameters() };

    // Inicializar a versão nova com base na versão selecionada
    this.new = new ConsensusVersion({ ...this.selected });
    this.newParams = { ...this.selectedParams };

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
    this.mode = 'creating';
    this.isEditing = true;
    this.paramChanged = false;
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
      this.newParams = { ...futureEpoch.parameters };
      this.applyImmediately = false;
    } else {
      // Criar uma nova versão com base nos parâmetros atuais da versão selecionada
      this.new = new ConsensusVersion({ ...this.selected });
      this.newParams = { ...this.selectedParams };
    }

    // Fazer uma cópia dos parâmetros atuais para poder restaurar caso necessário
    this.copy = { ...this.selectedParams };

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
      this.selectedParams.difficultyAdjustmentInterval = value;
      this.forkWarnings['difficultyAdjustmentInterval'] =
        value !== this.copy.difficultyAdjustmentInterval ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onMaxTransactionsChange(value: number) {
    if (!isNaN(value) && value >= 0) {
      this.selectedParams.maxTransactionsPerBlock = value;
      this.forkWarnings['maxTransactionsPerBlock'] =
        value !== this.copy.maxTransactionsPerBlock ? 'soft' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  onMaxBlockSizeChange(value: number) {
    if (!isNaN(value) && value > 0) {
      this.selectedParams.maxBlockSize = value;
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
      this.selectedParams.targetBlockTime = value;
      this.forkWarnings['targetBlockTime'] =
        value !== this.copy.targetBlockTime ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }

    this.onParametersChange();
  }

  confirmEdit() {
    if (this.existing) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Já existe uma versão com estes parâmetros',
      });
      return;
    }

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
      const updatedEpochs = [...this.selected.epochs];
      updatedEpochs[this.futureEpochIndex] = {
        ...updatedEpochs[this.futureEpochIndex],
        startHeight: this.startHeight,
        parameters: { ...this.newParams },
      };
      // Atualizar versão selecionada
      this.selected.epochs = updatedEpochs;
      this.selectedParams = { ...this.newParams };
      this.mode = 'viewing';
      this.isEditing = false;
      this.isEditingFutureEpoch = false;
      this.futureEpochIndex = null;
      this.messageService.add({
        severity: 'success',
        summary: 'Época futura atualizada',
        detail: `A época futura foi atualizada para altura ${this.startHeight}.`,
        life: 6000,
      });
      this.versionChange.emit();
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
      this.selected = new ConsensusVersion({ ...this.new });
      this.selectedParams = {
        ...this.newParams,
      };
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
      this.selectedParams = { ...selected.getCurrentConsensusParameters() };
      this.selected = selected;
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
    this.miner.consensus = new ConsensusVersion({ ...this.selected });
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
    this.mode = 'viewing';
    this.isEditing = false;
    this.selectedParams = { ...this.copy };
    this.clearMessages();
  }

  cancelVersionChange() {
    this.mode = 'viewing';
    this.selectedParams = { ...this.copy };
    this.clearMessages();
  }

  useExistingVersion() {
    if (this.existing) {
      this.selected = new ConsensusVersion({ ...this.existing });
      this.copy = {
        ...this.existing.getCurrentConsensusParameters(),
      };
      this.selectedParams = {
        ...this.existing.getCurrentConsensusParameters(),
      };
      this.mode = 'confirming';
    }
  }

  private prepareNewVersionInstance() {
    const newVersion = this.new.version + 1;

    // Se for aplicar imediatamente, usa a altura atual
    // Se não, usa a altura especificada pelo usuário
    const actualStartHeight = this.applyImmediately
      ? this.currentHeight
      : this.startHeight ?? this.currentHeight;

    const newEpoch: ConsensusEpoch = {
      startHeight: actualStartHeight,
      parameters: { ...this.newParams },
    };

    const previousEpochs = this.selected.epochs.filter(
      (e) => e.startHeight < actualStartHeight
    );

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
    this.existing = undefined;
    this.forkWarnings = {};
    this.updateConsolidatedFork();
  }

  private checkForExistingVersion() {
    if (!this.paramChanged) {
      this.existing = undefined;
      return;
    }

    this.existing = this.items.find((v) => v.hash === this.new.hash);
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
    this.paramChanged = true;
    this.prepareNewVersionInstance();
    this.checkForExistingVersion();
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

  get nextFutureEpochHeight(): number | null {
    if (!this.selected) return null;
    const future = this.selected.epochs
      .filter((e) => e.startHeight > this.currentHeight)
      .map((e) => e.startHeight);
    return future.length ? Math.min(...future) : null;
  }

  get futureEpochs(): any[] {
    if (!this.selected) return [];
    return this.selected.epochs.filter(
      (e) => e.startHeight > this.currentHeight
    );
  }

  hasFutureEpochs(version: ConsensusVersion): boolean {
    return version.epochs.some((e) => e.startHeight > this.currentHeight);
  }

  getNextFutureEpochHeight(version: ConsensusVersion): number | null {
    const future = version.epochs
      .filter((e) => e.startHeight > this.currentHeight)
      .map((e) => e.startHeight);
    return future.length ? Math.min(...future) : null;
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
