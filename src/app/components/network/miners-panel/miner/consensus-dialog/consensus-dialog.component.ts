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
import { Subject, takeUntil } from 'rxjs';
import {
  ConsensusParameters,
  ConsensusVersion,
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

  @Input() miner!: Node;

  @Output() close = new EventEmitter<void>();
  @Output() versionChange = new EventEmitter<void>();

  isEditingFutureEpoch = false;

  public selectedHasFutureEpochs = false;

  public futureInfoByVersion: {
    [hash: string]: {
      nextFutureEpochHeight: number | null;
      blocksToGo: number | null;
    };
  } = {};

  private blockSub: any;

  constructor(
    private consensusService: ConsensusService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    // Inicializar a altura atual do minerador
    this.currentHeight = this.miner.getLatestBlock()?.height || 0;

    // Inicializar a versão selecionada com a versão rodando no miner
    this.selected = this.miner.consensus;

    // Inicializar a versão nova com base na versão selecionada
    this.new = ConsensusVersion.deepCopy(this.selected);
    this.newParams = ConsensusParameters.deepCopy(this.paramsOnView ?? {});

    this.clearMessages();

    this.consensusService.versions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((versions) => {
        this.items = versions;
        this.updateView();
      });

    this.blockSub = this.miner.blockBroadcast$
      .pipe(takeUntil(this.destroy$))
      .subscribe((block) => {
        this.currentHeight = block.height;
        this.updateView();
      });

    this.updateView();
  }

  startEditing() {
    this.lastMode = this.mode;
    this.mode = 'creating';
    this.isEditing = true;
    this.touched = false;
    this.applyImmediately = true;
    this.isEditingFutureEpoch = false;

    // Definir a altura atual como referência
    this.currentHeight = this.miner.getLatestBlock()?.height || 0;
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
      this.versionChange.emit();
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
      if (selected.version !== this.miner.consensus.version) {
        this.mode = 'confirming';
      } else {
        this.mode = 'viewing';
      }
    }

    this.updateView();
  }

  confirmVersionChange() {
    this.miner.changeConsensus(this.selected);
    this.mode = 'viewing';
    this.clearMessages();
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: `Versão v${this.selected.version} agora está em uso.`,
      life: 6000,
    });
    this.versionChange.emit();
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
    this.blockSub?.unsubscribe();
  }
}
