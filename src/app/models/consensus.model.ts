import * as CryptoJS from 'crypto-js';
import { CONSENSUS_CONFIG } from '../config/consensus.config';

export interface ConsensusParameters {
  version: number;
  timestamp: number;
  difficultyAdjustmentInterval: number;
  maxTransactionsPerBlock: number;
  maxBlockSize: number;
  targetBlockTime: number;
  isLocal?: boolean;
  minerId?: number;
  hash?: string;
  instanceHash?: string;
  conflictVersion?: boolean;
}

export interface ConsensusEpoch {
  startHeight: number;
  endHeight?: number; // undefined significa "até o presente"
  parameters: ConsensusParameters;
  hash: string; // Hash único para esta época
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

// Função para calcular o hash de uma época
export function calculateEpochHash(epoch: ConsensusEpoch): string {
  const data = {
    startHeight: epoch.startHeight,
    endHeight: epoch.endHeight,
    parameters: epoch.parameters,
  };
  return CryptoJS.SHA256(JSON.stringify(data)).toString();
}

// Função para calcular o hash de uma versão de consenso
export function calculateConsensusVersionHash(
  version: ConsensusVersion
): string {
  const data = {
    version: version.version,
    timestamp: version.timestamp,
    epochs: version.epochs.map((e) => e.hash),
  };
  return CryptoJS.SHA256(JSON.stringify(data)).toString();
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
        version: 1,
        timestamp: Date.now(),
        difficultyAdjustmentInterval: 2016,
        maxTransactionsPerBlock: 0,
        maxBlockSize: 1,
        targetBlockTime: 10,
      },
      hash: '',
    },
  ],
  hash: '',
  instanceHash: '',
};

// Inicializa os hashes da versão padrão
DEFAULT_CONSENSUS.epochs[0].hash = calculateEpochHash(
  DEFAULT_CONSENSUS.epochs[0]
);
DEFAULT_CONSENSUS.hash = calculateConsensusVersionHash(DEFAULT_CONSENSUS);
DEFAULT_CONSENSUS.instanceHash =
  calculateConsensusInstanceHash(DEFAULT_CONSENSUS);
