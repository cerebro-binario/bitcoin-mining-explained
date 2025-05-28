export const environment = {
  production: false,
  consensus: {
    difficultyAdjustmentInterval: 10, // 10 blocos para ajuste de dificuldade
    targetBlockTime: 10, // 10 segundos por bloco
    maxTransactionsPerBlock: 0, // sem limite
    maxBlockSize: 4, // 4MB
    halvingInterval: 10, // padrão Bitcoin
  },
};
