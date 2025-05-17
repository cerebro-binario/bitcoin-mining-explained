import { Block } from './block.model';

export type ValidationType =
  | 'duplicate'
  | 'invalid-parent'
  | 'invalid-hash'
  | 'invalid-target'
  | 'invalid-timestamp'
  | 'invalid-nbits'
  | 'invalid-subsidy'
  | 'invalid-size'
  | 'invalid-transactions'
  | 'sync-complete'
  | 'misbehavior';

export type EventType =
  | 'block-received'
  | 'block-validated'
  | 'block-rejected'
  | 'sync-progress'
  | 'block-mined'
  | 'peer-disconnected'
  | 'peer-misbehavior';

export interface EventLog {
  type: EventType;
  from?: number;
  block?: Block;
  timestamp: number;
  reason?: ValidationType | 'sync-progress';
  message?: string;
  syncProgress?: {
    processed: number;
    total: number;
    blocksPerSecond: number;
    estimatedTimeRemaining: number;
  };
}

// Mapeamento de tipos de validação para mensagens
export const validationMessages: Record<
  ValidationType | 'sync-progress' | 'sync-complete' | 'block-mined',
  string
> = {
  duplicate: 'Bloco duplicado',
  'invalid-parent': 'Bloco órfão: bloco pai não encontrado',
  'invalid-hash': 'Hash do bloco inválido',
  'invalid-target': 'Bloco não atinge o target de dificuldade',
  'invalid-timestamp': 'Timestamp do bloco inválido',
  'invalid-nbits': 'Dificuldade (nBits) do bloco incorreta',
  'invalid-subsidy': 'Subsídio do bloco incorreto',
  'invalid-size': 'Tamanho do bloco excede o limite máximo',
  'invalid-transactions': 'Número de transações excede o limite máximo',
  'sync-progress': 'Sincronização em andamento',
  'sync-complete': 'Sincronização concluída',
  'block-mined': 'Bloco minerado',
  misbehavior: 'Peer desconectado por mau comportamento',
};
