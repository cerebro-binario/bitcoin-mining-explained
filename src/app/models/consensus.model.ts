import * as CryptoJS from 'crypto-js';
import { CONSENSUS_CONFIG } from '../config/consensus.config';

export interface ConsensusParameters {
  difficultyAdjustmentInterval: number;
  maxTransactionsPerBlock: number;
  maxBlockSize: number;
  targetBlockTime: number;
}

export interface ConsensusEpoch {
  startHeight: number;
  endHeight?: number; // undefined significa "até o presente"
  parameters: ConsensusParameters;
}

export class ConsensusVersion {
  version: number = -1;
  timestamp: number = -1;
  epochs: ConsensusEpoch[] = [];
  minerId?: number;
  hash: string = '';

  constructor(data: Partial<ConsensusVersion>) {
    Object.assign(this, data);
  }

  getCurrentConsensusParameters(): ConsensusParameters {
    return this.epochs[this.epochs.length - 1].parameters;
  }

  calculateHash(): string {
    const data = JSON.stringify(this.epochs);
    this.hash = CryptoJS.SHA256(data).toString();
    return this.hash;
  }

  getConsensusForHeight(height: number): ConsensusParameters {
    const epoch = this.epochs.find(
      (e) => height >= e.startHeight && (!e.endHeight || height < e.endHeight)
    );
    if (!epoch) {
      throw new Error(`No consensus parameters found for height ${height}`);
    }
    return epoch.parameters;
  }
}

// Versão padrão do consenso (com uma única época)
export const DEFAULT_CONSENSUS: ConsensusVersion = new ConsensusVersion({
  version: 1,
  timestamp: Date.now(),
  epochs: [
    {
      startHeight: 0,
      parameters: { ...CONSENSUS_CONFIG },
    },
  ],
});

// Inicializa o hash da versão padrão
DEFAULT_CONSENSUS.calculateHash();
