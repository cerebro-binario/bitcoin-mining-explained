import * as CryptoJS from 'crypto-js';
import { CONSENSUS_CONFIG } from '../config/consensus.config';

export interface IConsensusParameters {
  difficultyAdjustmentInterval: number;
  maxTransactionsPerBlock: number;
  maxBlockSize: number;
  targetBlockTime: number;
  hash: string;
}

export class ConsensusParameters implements IConsensusParameters {
  difficultyAdjustmentInterval: number = 0;
  maxTransactionsPerBlock: number = 0;
  maxBlockSize: number = 0;
  targetBlockTime: number = 0;
  hash: string = '';

  constructor(data: Partial<IConsensusParameters>) {
    Object.assign(this, { ...data });
  }

  static deepCopy(data: Partial<IConsensusParameters>): ConsensusParameters {
    return new ConsensusParameters({ ...data });
  }

  calculateHash(): string {
    const { hash: _, ...rest } = this;
    const data = JSON.stringify(rest);
    const hash = CryptoJS.SHA256(data).toString();
    this.hash = hash;
    return hash;
  }
}

export class ConsensusVersion {
  version: number = -1;
  timestamp: number = -1;
  startHeight: number = 0;
  endHeight?: number;
  parameters: IConsensusParameters = new ConsensusParameters({});
  minerId?: number;
  hash: string = '';
  previousVersion?: ConsensusVersion;

  constructor(data: Partial<ConsensusVersion>) {
    Object.assign(this, data);

    // Deep copy dos parâmetros
    if (data.parameters) {
      this.parameters = ConsensusParameters.deepCopy(data.parameters);
    }
  }

  static deepCopy(data: Partial<ConsensusVersion>): ConsensusVersion {
    return new ConsensusVersion({ ...data });
  }

  calculateHash(): string {
    const data = JSON.stringify({
      startHeight: this.startHeight,
      endHeight: this.endHeight,
      parameters: this.parameters,
      previousVersion: this.previousVersion,
    });
    this.hash = CryptoJS.SHA256(data).toString();
    return this.hash;
  }

  getConsensusForHeight(height: number): ConsensusVersion {
    if (
      height >= this.startHeight &&
      (!this.endHeight || height < this.endHeight)
    ) {
      return this;
    }
    if (this.previousVersion) {
      return this.previousVersion.getConsensusForHeight(height);
    }
    throw new Error(`No consensus parameters found for height ${height}`);
  }
}

const DEFAULT_CONSENSUS_PARAMETERS = new ConsensusParameters({
  ...CONSENSUS_CONFIG,
  hash: '',
});
DEFAULT_CONSENSUS_PARAMETERS.calculateHash();

// Versão padrão do consenso (com uma única época)
export const DEFAULT_CONSENSUS: ConsensusVersion = new ConsensusVersion({
  version: 1,
  timestamp: Date.now(),
  startHeight: 0,
  parameters: DEFAULT_CONSENSUS_PARAMETERS,
  previousVersion: undefined,
});

// Inicializa o hash da versão padrão
DEFAULT_CONSENSUS.calculateHash();
