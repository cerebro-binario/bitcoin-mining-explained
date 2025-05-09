export const environment = {
  production: true,
  consensus: {
    difficultyAdjustmentInterval: 2016, // Bitcoin-like
    targetBlockTime: 600, // 10 minutos
    maxTransactionsPerBlock: 0, // sem limite
    maxBlockSize: 1, // 1MB
  },
};
