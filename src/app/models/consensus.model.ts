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

export interface IConsensusEpoch {
  startHeight: number;
  endHeight?: number; // undefined significa "até o presente"
  parameters: IConsensusParameters;
}

export class ConsensusEpoch implements IConsensusEpoch {
  startHeight: number = 0;
  endHeight?: number;
  parameters: IConsensusParameters = new ConsensusParameters({});

  constructor(data: Partial<IConsensusEpoch>) {
    Object.assign(this, data);
    this.parameters = ConsensusParameters.deepCopy({ ...data.parameters }!);
  }

  static deepCopy(data: Partial<IConsensusEpoch>): ConsensusEpoch {
    return new ConsensusEpoch({ ...data });
  }
}

export class ConsensusVersion {
  version: number = -1;
  timestamp: number = -1;
  epochs: IConsensusEpoch[] = [];
  minerId?: number;
  hash: string = '';

  constructor(data: Partial<ConsensusVersion>) {
    Object.assign(this, data);

    // Deep copy dos parâmetros
    if (data.epochs) {
      this.epochs = data.epochs.map((e) => ConsensusEpoch.deepCopy(e));
    }
  }

  static deepCopy(data: Partial<ConsensusVersion>): ConsensusVersion {
    return new ConsensusVersion({ ...data });
  }

  getCurrentConsensusParameters(): IConsensusParameters {
    return this.epochs[this.epochs.length - 1].parameters;
  }

  calculateHash(): string {
    const data = JSON.stringify(this.epochs);
    this.hash = CryptoJS.SHA256(data).toString();
    return this.hash;
  }

  getConsensusForHeight(height: number): IConsensusParameters {
    const epoch = this.epochs.find(
      (e) => height >= e.startHeight && (!e.endHeight || height < e.endHeight)
    );
    if (!epoch) {
      throw new Error(`No consensus parameters found for height ${height}`);
    }
    return epoch.parameters;
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
  epochs: [
    {
      startHeight: 0,
      parameters: DEFAULT_CONSENSUS_PARAMETERS,
    },
  ],
});

// Inicializa o hash da versão padrão
DEFAULT_CONSENSUS.calculateHash();
