export const environment = {
  production: false,
  consensus: {
    difficultyAdjustmentInterval: 10, // 10 blocos para ajuste de dificuldade
    targetBlockTime: 10, // 10 segundos por bloco
    maxTransactionsPerBlock: 0, // sem limite
    maxBlockSize: 1, // 1MB
  },
};
