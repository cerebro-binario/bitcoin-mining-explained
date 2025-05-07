export interface ConsensusParameters {
  // The number of blocks between difficulty adjustments
  difficultyAdjustmentInterval: number;
  // The version of the consensus rules this miner is following
  consensusVersion: string;
  // Timestamp when these parameters were set
  timestamp: Date;
  // Maximum transactions per block
  maxTransactionsPerBlock: number;
  // Maximum block size
  maxBlockSize: number;
}

// Default Bitcoin-like consensus parameters
export const DEFAULT_CONSENSUS: ConsensusParameters = {
  difficultyAdjustmentInterval: 2016,
  consensusVersion: '1.0.0',
  timestamp: new Date(),
  maxTransactionsPerBlock: 0, // 0 = sem limite
  maxBlockSize: 1, // 1MB
};
