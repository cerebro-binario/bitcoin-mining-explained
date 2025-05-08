import * as CryptoJS from 'crypto-js';

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
}

// Default Bitcoin-like consensus parameters
const DEFAULT_CONSENSUS: ConsensusParameters = {
  difficultyAdjustmentInterval: 2016,
  version: '1.0.0',
  hash: '0000000000000000000000000000000000000000000000000000000000000000',
  timestamp: new Date(),
  maxTransactionsPerBlock: 0, // 0 = sem limite
  maxBlockSize: 1, // 1MB
  isLocal: false,
};
DEFAULT_CONSENSUS.hash = calculateConsensusVersionHash(DEFAULT_CONSENSUS);

export { DEFAULT_CONSENSUS };

export function calculateConsensusVersionHash(
  params: ConsensusParameters
): string {
  const data = JSON.stringify({
    difficultyAdjustmentInterval: params.difficultyAdjustmentInterval,
    maxTransactionsPerBlock: params.maxTransactionsPerBlock,
    maxBlockSize: params.maxBlockSize,
  });
  return CryptoJS.SHA256(data).toString();
}
