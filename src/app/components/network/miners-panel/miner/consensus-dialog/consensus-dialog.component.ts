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

  isEditing = false;
  paramChanged = false;
  mode: 'creating' | 'confirming' | 'viewing' = 'viewing';

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
  }

  startEditing() {
    this.mode = 'creating';
    this.isEditing = true;
    this.paramChanged = false;

    // Criar uma nova versão com base nos parâmetros atuais da versão selecionada
    this.new = new ConsensusVersion({ ...this.selected });
    this.newParams = { ...this.selectedParams };

    // Fazer uma cópia dos parâmetros atuais para poder restaurar caso necessário
    this.copy = { ...this.selectedParams };

    // Limpar mensagens de erro e sucesso
    this.clearMessages();
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

    const success = this.publishVersion();

    if (success) {
      this.selected = new ConsensusVersion({ ...this.new });
      this.selectedParams = {
        ...this.newParams,
      };
      this.mode = 'confirming';
      this.clearMessages();
    }
  }

  onVersionSelect(event: any) {
    this.clearMessages();

    if (event.value) {
      const selected = event.value as ConsensusVersion;

      this.selectedParams = { ...selected.getCurrentConsensusParameters() };

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

  private prepareNewVersionInstance(startHeight?: number) {
    // Pegar altura atual (do current block) caso usuário não tenha definido uma
    startHeight = startHeight ?? (this.miner.currentBlock?.height || 0);

    let newEpoch: ConsensusEpoch = {
      startHeight,
      parameters: { ...this.newParams },
    };

    const previousEpochs = this.selected.epochs
      .filter((epoch) => epoch.startHeight < startHeight)
      .map((epoch) => ({
        ...epoch,
      }));

    this.new = new ConsensusVersion({
      version: -1,
      timestamp: -1,
      epochs: [...previousEpochs, newEpoch],
    });

    if (previousEpochs.length > 0) {
      const lastEpoch = previousEpochs[previousEpochs.length - 1];
      lastEpoch.endHeight = startHeight - 1;
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
}
