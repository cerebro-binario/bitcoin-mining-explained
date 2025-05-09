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
  ConsensusParameters,
  DEFAULT_CONSENSUS,
} from '../../../../../models/consensus.model';
import { Node } from '../../../../../models/node';
import { ConsensusService } from '../../../../../services/consensus.service';
import { ForkWarningComponent } from './fork-warning.component';

type ForkType = 'none' | 'soft' | 'hard';

interface GroupedConsensusVersions {
  label: string;
  items: ConsensusParameters[];
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
  private originalParams: ConsensusParameters = { ...DEFAULT_CONSENSUS };

  mode: 'creating' | 'confirming' | 'viewing' = 'viewing';
  isEditing = false;
  editingParams: ConsensusParameters = { ...DEFAULT_CONSENSUS };
  isGrouped = false;
  versions: ConsensusParameters[] = [];
  versionsByGroup: GroupedConsensusVersions[] = [];
  existingVersion?: ConsensusParameters;
  hasAnyConflict = false;

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
    this.editingParams = { ...this.miner.consensus };
    this.originalParams = { ...this.miner.consensus };
    this.clearMessages();

    this.consensusService.versions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((versions) => {
        this.updateVersionList(versions);
      });
  }

  startEditing() {
    this.clearMessages();
    this.checkForExistingVersion();
    this.paramChanged = false;
    this.mode = 'creating';
    this.isEditing = true;
    this.originalParams = { ...this.editingParams };
  }

  confirmEdit() {
    // Atualize o consolidatedFork antes de salvar, se necessário
    this.updateConsolidatedFork();

    if (this.consolidatedFork.type === 'hard') {
      this.incrementMajorVersion();
    } else if (this.consolidatedFork.type === 'soft') {
      this.incrementMinorVersion();
    } else if (
      this.editingParams.difficultyAdjustmentInterval !==
        this.originalParams.difficultyAdjustmentInterval ||
      this.editingParams.maxTransactionsPerBlock !==
        this.originalParams.maxTransactionsPerBlock ||
      this.editingParams.maxBlockSize !== this.originalParams.maxBlockSize
    ) {
      this.incrementPatchVersion();
    }

    const created = this.miner.createConsensusVersion(this.editingParams);
    if (created) {
      this.miner.consensus = this.editingParams;

      // Atualizar a lista de versões, já que se trata de uma versão local (ainda não publicada)
      this.updateVersionList(this.consensusService.versions);

      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: `Versão v${this.editingParams.version} criada com sucesso e já esta em uso!`,
        life: 6000,
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao criar versão do consenso. Tente novamente.',
        life: 6000,
      });
    }

    this.isEditing = false;
    this.mode = 'viewing';
    this.clearMessages();
  }

  cancelEdit() {
    this.editingParams = { ...this.miner.consensus };
    this.isEditing = false;
    this.mode = 'viewing';
    this.clearMessages();
  }

  onIntervalChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingParams.difficultyAdjustmentInterval = value;
      this.forkWarnings['difficultyAdjustmentInterval'] =
        value !== DEFAULT_CONSENSUS.difficultyAdjustmentInterval
          ? 'hard'
          : 'none';
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onMaxTransactionsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value >= 0) {
      this.editingParams.maxTransactionsPerBlock = value;
      this.forkWarnings['maxTransactionsPerBlock'] =
        value !== DEFAULT_CONSENSUS.maxTransactionsPerBlock ? 'soft' : 'none';
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onMaxBlockSizeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingParams.maxBlockSize = value;
      if (value < DEFAULT_CONSENSUS.maxBlockSize) {
        this.forkWarnings['maxBlockSize'] = 'soft';
      } else if (value > DEFAULT_CONSENSUS.maxBlockSize) {
        this.forkWarnings['maxBlockSize'] = 'hard';
      } else {
        this.forkWarnings['maxBlockSize'] = 'none';
      }
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onTargetBlockTimeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    if (!isNaN(value) && value > 0) {
      this.editingParams.targetBlockTime = value;
      this.forkWarnings['targetBlockTime'] =
        value !== DEFAULT_CONSENSUS.targetBlockTime ? 'hard' : 'none';
      this.updateConsolidatedFork();
    }
    this.paramChanged = true;
    this.checkForExistingVersion();
  }

  onVersionSelect(event: any) {
    this.clearMessages();
    this.updateConsolidatedFork();

    if (event.value) {
      const selected = event.value as ConsensusParameters;
      if (selected.version !== this.miner.consensus.version) {
        this.editingParams = { ...selected };
        this.mode = 'confirming';
      } else {
        this.mode = 'viewing';
      }
    }
  }

  confirmVersionChange() {
    this.miner.consensus = this.editingParams;
    this.mode = 'viewing';
    this.clearMessages();
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: `Versão v${this.editingParams.version} agora está em uso.`,
      life: 6000,
    });
  }

  cancelVersionChange() {
    this.editingParams = { ...this.miner.consensus };
    this.isEditing = false;
    this.mode = 'viewing';
    this.clearMessages();
  }

  syncAllConflicts() {
    this.syncCurrentConflict();

    this.miner.localConsensusVersions =
      this.miner.localConsensusVersions.filter((v) => !v.conflictVersion);

    this.updateVersionList(this.consensusService.versions);

    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail:
        'Todos as versões locais em conflito foram sincronizadas e removidas.',
      life: 6000,
    });
  }

  syncCurrentConflict() {
    let needUpdate = false;

    // Sincroniza a versão local com a versão publicada na rede
    if (this.editingParams.conflictVersion) {
      const published = this.consensusService.versions.find(
        (v) => v.version === this.editingParams.conflictVersion
      );
      if (published) {
        this.clearMessages();
        needUpdate = true;
        // Remove a versão local em conflito
        this.miner.localConsensusVersions =
          this.miner.localConsensusVersions.filter(
            (v) => v.version !== this.editingParams.conflictVersion
          );

        // Atualiza a versão local com a versão publicada na rede
        this.editingParams = { ...published };
      }
    }

    // Sincroniza a versão em uso com a versão publicada na rede
    if (this.miner.consensus.conflictVersion) {
      const published = this.consensusService.versions.find(
        (v) => v.version === this.miner.consensus.conflictVersion
      );
      if (published) {
        this.clearMessages();
        needUpdate = true;

        // Remove a versão local em conflito
        this.miner.localConsensusVersions =
          this.miner.localConsensusVersions.filter(
            (v) => v.version !== this.miner.consensus.conflictVersion
          );

        // Atualiza a versão em uso com a versão publicada na rede
        this.miner.consensus = { ...published };

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: `Versão local sincronizada com a versão v${this.miner.consensus.version} publicada na rede.`,
          life: 6000,
        });
      }
    }

    if (needUpdate) {
      this.updateVersionList(this.consensusService.versions);
    }
  }

  private clearMessages() {
    this.error = null;
    this.info = null;
    this.existingVersion = undefined;
    this.forkWarnings = {};
    this.updateConsolidatedFork();
  }

  private incrementMajorVersion() {
    const versionParts = this.editingParams.version.split('.');
    versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
    versionParts[1] = '0';
    versionParts[2] = '0';
    this.editingParams.version = versionParts.join('.');
  }

  private incrementMinorVersion() {
    const versionParts = this.editingParams.version.split('.');
    versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
    versionParts[2] = '0';
    this.editingParams.version = versionParts.join('.');
  }

  private incrementPatchVersion() {
    const versionParts = this.editingParams.version.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    this.editingParams.version = versionParts.join('.');
  }

  private updateConsolidatedFork() {
    const hardParams = Object.entries(this.forkWarnings)
      .filter(([_, type]) => type === 'hard')
      .map(([param]) => this.getParamLabel(param));
    if (hardParams.length > 0) {
      this.consolidatedFork = { type: 'hard', params: hardParams };
      return;
    }
    const softParams = Object.entries(this.forkWarnings)
      .filter(([_, type]) => type === 'soft')
      .map(([param]) => this.getParamLabel(param));
    if (softParams.length > 0) {
      this.consolidatedFork = { type: 'soft', params: softParams };
      return;
    }
    this.consolidatedFork = { type: 'none', params: [] };
  }

  getParamLabel(param: string): string {
    switch (param) {
      case 'difficultyAdjustmentInterval':
        return 'Intervalo de Ajuste de Dificuldade';
      case 'maxBlockSize':
        return 'Tamanho Máximo do Bloco';
      case 'maxTransactionsPerBlock':
        return 'Máximo de Transações por Bloco';
      case 'targetBlockTime':
        return 'Tempo Alvo de Bloco';
      default:
        return param;
    }
  }

  isParamInFork(param: string): boolean {
    return this.consolidatedFork.params.includes(this.getParamLabel(param));
  }

  private updateVersionList(networkVersions: ConsensusParameters[]) {
    this.handleDuplicatedAndConflictedVersions(networkVersions);

    this.versionsByGroup = [
      {
        label: 'Rede',
        items: networkVersions,
      },
      {
        label: 'Local',
        items: this.miner.localConsensusVersions,
      },
    ].filter((group) => group.items.length > 0);

    this.isGrouped = this.versionsByGroup.length > 1;

    if (!this.isGrouped) {
      this.versions = this.versionsByGroup.flatMap((group) => group.items);
    } else {
      this.versions = [];
    }
  }

  private handleDuplicatedAndConflictedVersions(
    networkVersions: ConsensusParameters[]
  ) {
    this.hasAnyConflict = false;

    // Remover a versão local se ela foi publicada na rede pelo mesmo miner (duplicada)
    // e marcar a versão local como conflitante se ela foi publicada na rede por outro miner (conflito)
    this.miner.localConsensusVersions =
      this.miner.localConsensusVersions.filter(
        (v) =>
          !networkVersions.some((nv) => {
            const sameHash = nv.hash === v.hash;
            const sameMiner = nv.minerId === v.minerId;
            const remove = sameHash && sameMiner;

            if (sameHash && !sameMiner) {
              v.conflictVersion = nv.version;
              this.hasAnyConflict = true;

              if (v.instanceHash === this.editingParams.instanceHash) {
                this.editingParams.conflictVersion = nv.version;
              }
            }

            if (remove && this.miner.consensus.hash === v.hash) {
              this.miner.consensus = this.editingParams = { ...nv };
            }

            return remove;
          })
      );
  }

  private checkForExistingVersion() {
    const currentHash = calculateConsensusVersionHash(this.editingParams);

    this.existingVersion =
      this.consensusService.versions.find((v) => v.hash === currentHash) ||
      this.miner.localConsensusVersions.find((v) => v.hash === currentHash);

    if (this.existingVersion) {
      const from = this.existingVersion.isLocal ? 'no minerador' : 'na rede';
      this.info = `Versão v${this.existingVersion.version} já existe ${from} com os mesmos parâmetros.`;
    } else {
      this.info = null;
    }
  }

  useExistingVersion() {
    if (this.existingVersion) {
      this.editingParams = { ...this.existingVersion };
      this.mode = 'confirming';
      this.clearMessages();
      this.updateConsolidatedFork();
    }
  }

  publishVersion() {
    const success = this.consensusService.publishConsensus(this.editingParams);

    if (!success) {
      // Se não foi publicado, exibir mensagem de erro
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
      summary: `Versão v${this.editingParams.version} publicada na rede!`,
      detail: 'Outros nodes poderão atualizar para a nova versão.',
      life: 6000,
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
