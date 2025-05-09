import * as CryptoJS from 'crypto-js';
import { CONSENSUS_CONFIG } from '../config/consensus.config';

export interface ConsensusParameters {
  // The number of blocks between difficulty adjustments
  difficultyAdjustmentInterval: number;
  // Maximum transactions per block
  maxTransactionsPerBlock: number;
  // Maximum block size
  maxBlockSize: number;
  // The version of the consensus rules this miner is following
  version: string;
  // The hash of the version of the consensus rules this miner is following
  hash: string;
  // Timestamp when these parameters were set
  timestamp: Date;
  // Whether this is a local version or not
  isLocal: boolean;
  // The id of the miner that published this version
  minerId?: number;
  // The hash of the version of the consensus rules that this miner is conflicting with
  conflictVersion?: string;
  // The hash of the instance of the version of the consensus rules
  instanceHash?: string;
  // Tempo alvo de bloco em segundos
  targetBlockTime: number;
}

// Default consensus parameters based on environment
export const DEFAULT_CONSENSUS: ConsensusParameters = {
  difficultyAdjustmentInterval: CONSENSUS_CONFIG.difficultyAdjustmentInterval,
  targetBlockTime: CONSENSUS_CONFIG.targetBlockTime,
  maxTransactionsPerBlock: CONSENSUS_CONFIG.maxTransactionsPerBlock,
  maxBlockSize: CONSENSUS_CONFIG.maxBlockSize,
  isLocal: false,
  version: '1.0.0',
  hash: '0000000000000000000000000000000000000000000000000000000000000000',
  timestamp: new Date(),
};

// Calculate initial hash
DEFAULT_CONSENSUS.hash = calculateConsensusVersionHash(DEFAULT_CONSENSUS);

export function calculateConsensusVersionHash(
  params: ConsensusParameters
): string {
  const data = JSON.stringify({
    difficultyAdjustmentInterval: params.difficultyAdjustmentInterval,
    maxTransactionsPerBlock: params.maxTransactionsPerBlock,
    maxBlockSize: params.maxBlockSize,
    targetBlockTime: params.targetBlockTime,
  });
  return CryptoJS.SHA256(data).toString();
}

export function calculateConsensusInstanceHash(
  params: ConsensusParameters
): string {
  const data = JSON.stringify(params);
  return CryptoJS.SHA256(data).toString();
}
