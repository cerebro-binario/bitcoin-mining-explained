import { environment } from '../../environments/environment';

export interface ConsensusConfig {
  difficultyAdjustmentInterval: number;
  targetBlockTime: number;
  maxTransactionsPerBlock: number;
  maxBlockSize: number;
  halvingInterval: number;
}

// Usa a configuração do environment atual
export const CONSENSUS_CONFIG: ConsensusConfig = environment.consensus;
