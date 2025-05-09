import * as CryptoJS from 'crypto-js';

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

export interface ConsensusVersion {
  version: number;
  timestamp: number;
  epochs: ConsensusEpoch[];
  isLocal?: boolean;
  minerId?: number;
  hash: string;
  instanceHash: string;
  conflictVersion?: boolean;
}

// Função para calcular o hash de uma versão de consenso
export function calculateConsensusVersionHash(
  version: ConsensusVersion
): string {
  const data = JSON.stringify(version.epochs);
  return CryptoJS.SHA256(data).toString();
}

// Função para calcular o hash de instância (inclui minerId)
export function calculateConsensusInstanceHash(
  version: ConsensusVersion
): string {
  const data = {
    hash: version.hash,
    minerId: version.minerId,
  };
  return CryptoJS.SHA256(JSON.stringify(data)).toString();
}

// Função para obter os parâmetros de consenso para uma altura específica
export function getConsensusForHeight(
  version: ConsensusVersion,
  height: number
): ConsensusParameters {
  const epoch = version.epochs.find(
    (e) => height >= e.startHeight && (!e.endHeight || height < e.endHeight)
  );
  if (!epoch) {
    throw new Error(`No consensus parameters found for height ${height}`);
  }
  return epoch.parameters;
}

// Versão padrão do consenso (com uma única época)
export const DEFAULT_CONSENSUS: ConsensusVersion = {
  version: 1,
  timestamp: Date.now(),
  epochs: [
    {
      startHeight: 0,
      parameters: {
        difficultyAdjustmentInterval: 2016,
        maxTransactionsPerBlock: 0,
        maxBlockSize: 1,
        targetBlockTime: 10,
      },
    },
  ],
  hash: '',
  instanceHash: '',
};

// Inicializa os hashes da versão padrão
DEFAULT_CONSENSUS.hash = calculateConsensusVersionHash(DEFAULT_CONSENSUS);
DEFAULT_CONSENSUS.instanceHash =
  calculateConsensusInstanceHash(DEFAULT_CONSENSUS);
