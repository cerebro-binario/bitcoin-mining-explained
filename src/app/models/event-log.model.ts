export type ValidationType =
  | 'duplicate'
  | 'invalid-parent'
  | 'invalid-hash'
  | 'invalid-target'
  | 'invalid-timestamp'
  | 'invalid-nbits'
  | 'invalid-subsidy';

export type EventType =
  | 'block-received'
  | 'block-validated'
  | 'block-rejected'
  | 'sync-progress';

export interface EventLog {
  type: EventType;
  from?: number;
  blockHash: string;
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
  ValidationType | 'sync-progress',
  string
> = {
  duplicate: 'Bloco duplicado',
  'invalid-parent': 'Bloco órfão: bloco pai não encontrado',
  'invalid-hash': 'Hash do bloco inválido',
  'invalid-target': 'Bloco não atinge o target de dificuldade',
  'invalid-timestamp': 'Timestamp do bloco inválido',
  'invalid-nbits': 'Dificuldade (nBits) do bloco incorreta',
  'invalid-subsidy': 'Subsídio do bloco incorreto',
  'sync-progress': 'Sincronização em andamento',
};
