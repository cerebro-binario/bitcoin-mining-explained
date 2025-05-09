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
  calculateConsensusVersionHash,
  ConsensusEpoch,
  ConsensusVersion,
  DEFAULT_CONSENSUS,
} from '../../../../../models/consensus.model';
import { Node } from '../../../../../models/node';
import { ConsensusService } from '../../../../../services/consensus.service';
import { ForkWarningComponent } from './fork-warning.component';

type ForkType = 'none' | 'soft' | 'hard';

interface GroupedConsensusVersions {
  label: string;
  items: ConsensusVersion[];
}

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
  private originalVersion: ConsensusVersion = { ...DEFAULT_CONSENSUS };

  versions: ConsensusVersion[] = [];

  mode: 'creating' | 'confirming' | 'viewing' = 'viewing';
  isEditing = false;
  editingVersion: ConsensusVersion = { ...DEFAULT_CONSENSUS };
  existingVersion?: ConsensusVersion;

  // Scalable fork warning system
  forkWarnings: { [param: string]: ForkType } = {};
  consolidatedFork: { type: ForkType; params: string[] } = {
    type: 'none',
    params: [],
  };

  error: string | null = null;
  info: string | null = null;
  @Input() miner!: Node;

  @Output() close = new EventEmitter<void>();

  paramChanged = false;

  constructor(
    private consensusService: ConsensusService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.editingVersion = { ...this.miner.consensus };
    this.originalVersion = { ...this.miner.consensus };
    this.clearMessages();

    this.consensusService.versions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((versions) => {
        this.versions = versions;
      });
  }

  startEditing() {
    this.clearMessages();
    this.checkForExistingVersion();
    this.paramChanged = false;
    this.mode = 'creating';
    this.isEditing = true;
    this.originalVersion = { ...this.editingVersion };

    // Create a new epoch based on the last current epoch
    const lastEpoch =
      this.miner.consensus.epochs[this.miner.consensus.epochs.length - 1];
    this.editingVersion = {
      version: this.miner.consensus.version + 1,
      timestamp: Date.now(),
      epochs: [
        {
          startHeight: lastEpoch.endHeight || lastEpoch.startHeight,
          parameters: { ...lastEpoch.parameters },
        },
      ],
      hash: '',
      instanceHash: '',
    };
  }

  confirmEdit() {
    if (this.existingVersion) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Já existe uma versão com estes parâmetros',
      });
      return;
    }

    this.editingVersion.hash = calculateConsensusVersionHash(
      this.editingVersion
    );

    this.publishVersion();
  }

  onIntervalChange(event: Event, epochIndex: number) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingVersion.epochs[
        epochIndex
      ].parameters.difficultyAdjustmentInterval = value;
      this.forkWarnings['difficultyAdjustmentInterval'] =
        value !==
        DEFAULT_CONSENSUS.epochs[0].parameters.difficultyAdjustmentInterval
          ? 'hard'
          : 'none';
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onMaxTransactionsChange(event: Event, epochIndex: number) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value >= 0) {
      this.editingVersion.epochs[
        epochIndex
      ].parameters.maxTransactionsPerBlock = value;
      this.forkWarnings['maxTransactionsPerBlock'] =
        value !== DEFAULT_CONSENSUS.epochs[0].parameters.maxTransactionsPerBlock
          ? 'soft'
          : 'none';
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onMaxBlockSizeChange(event: Event, epochIndex: number) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingVersion.epochs[epochIndex].parameters.maxBlockSize = value;
      if (value < DEFAULT_CONSENSUS.epochs[0].parameters.maxBlockSize) {
        this.forkWarnings['maxBlockSize'] = 'soft';
      } else if (value > DEFAULT_CONSENSUS.epochs[0].parameters.maxBlockSize) {
        this.forkWarnings['maxBlockSize'] = 'hard';
      } else {
        this.forkWarnings['maxBlockSize'] = 'none';
      }
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onTargetBlockTimeChange(event: Event, epochIndex: number) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingVersion.epochs[epochIndex].parameters.targetBlockTime = value;
      this.forkWarnings['targetBlockTime'] =
        value !== DEFAULT_CONSENSUS.epochs[0].parameters.targetBlockTime
          ? 'hard'
          : 'none';
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onVersionSelect(event: any) {
    this.clearMessages();
    this.updateConsolidatedFork();

    if (event.value) {
      const selected = event.value as ConsensusVersion;
      if (selected.version !== this.miner.consensus.version) {
        this.editingVersion = { ...selected };
        this.mode = 'confirming';
      } else {
        this.mode = 'viewing';
      }
    }
  }

  confirmVersionChange() {
    this.close.emit();
  }

  private clearMessages() {
    this.error = null;
    this.info = null;
  }

  private checkForExistingVersion() {
    if (!this.paramChanged) {
      this.existingVersion = undefined;
      return;
    }

    this.existingVersion = this.versions.find(
      (v) =>
        v.version !== this.editingVersion.version &&
        v.epochs[0].parameters.difficultyAdjustmentInterval ===
          this.editingVersion.epochs[0].parameters
            .difficultyAdjustmentInterval &&
        v.epochs[0].parameters.maxTransactionsPerBlock ===
          this.editingVersion.epochs[0].parameters.maxTransactionsPerBlock &&
        v.epochs[0].parameters.maxBlockSize ===
          this.editingVersion.epochs[0].parameters.maxBlockSize &&
        v.epochs[0].parameters.targetBlockTime ===
          this.editingVersion.epochs[0].parameters.targetBlockTime
    );
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

  onEpochStartHeightChange(value: number, epochIndex: number) {
    if (!isNaN(value) && value >= 0) {
      this.editingVersion.epochs[epochIndex].startHeight = value;
      this.validateEpochHeights();
      this.paramChanged = true;
      this.checkForExistingVersion();
    }
  }

  onEpochEndHeightChange(value: number, epochIndex: number) {
    if (
      !isNaN(value) &&
      value > this.editingVersion.epochs[epochIndex].startHeight
    ) {
      this.editingVersion.epochs[epochIndex].endHeight = value;
      this.validateEpochHeights();
      this.paramChanged = true;
      this.checkForExistingVersion();
    }
  }

  addEpoch() {
    const lastEpoch =
      this.editingVersion.epochs[this.editingVersion.epochs.length - 1];
    const newEpoch: ConsensusEpoch = {
      startHeight: lastEpoch.endHeight || lastEpoch.startHeight + 1,
      parameters: { ...lastEpoch.parameters },
    };
    this.editingVersion.epochs.push(newEpoch);
    this.paramChanged = true;
  }

  removeEpoch(index: number) {
    if (index > 0) {
      this.editingVersion.epochs.splice(index, 1);
      this.validateEpochHeights();
      this.paramChanged = true;
    }
  }

  private validateEpochHeights() {
    // Sort epochs by start height
    this.editingVersion.epochs.sort((a, b) => a.startHeight - b.startHeight);

    // Ensure epochs don't overlap
    for (let i = 0; i < this.editingVersion.epochs.length - 1; i++) {
      const currentEpoch = this.editingVersion.epochs[i];
      const nextEpoch = this.editingVersion.epochs[i + 1];

      if (
        currentEpoch.endHeight === undefined ||
        currentEpoch.endHeight >= nextEpoch.startHeight
      ) {
        currentEpoch.endHeight = nextEpoch.startHeight - 1;
      }
    }
  }

  publishVersion() {
    const success = this.consensusService.publishConsensus(this.editingVersion);

    if (!success) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao publicar versão na rede. Tente novamente.',
        life: 6000,
      });
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: `Versão v${this.editingVersion.version} criada e publicada na rede.`,
      detail: 'Outros nodes poderão atualizar para a nova versão.',
      life: 6000,
    });
  }

  isParamInFork(param: string): boolean {
    return this.consolidatedFork.params.includes(param);
  }

  cancelEdit() {
    this.mode = 'viewing';
    this.isEditing = false;
    this.editingVersion = { ...this.originalVersion };
    this.clearMessages();
  }

  cancelVersionChange() {
    this.mode = 'viewing';
    this.editingVersion = { ...this.originalVersion };
    this.clearMessages();
  }

  useExistingVersion() {
    if (this.existingVersion) {
      this.editingVersion = { ...this.existingVersion };
      this.mode = 'confirming';
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
