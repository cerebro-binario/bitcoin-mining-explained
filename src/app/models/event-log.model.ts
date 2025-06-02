export type NodeEventType =
  | 'block-mined'
  | 'block-received'
  | 'peer-search'
  | 'peer-requested-connection'
  | 'peer-disconnected'
  | 'consensus-change'
  | 'difficulty-adjustment'
  | 'halving';

export type EventLogType =
  | 'peer-found'
  | 'peer-connected'
  | 'max-peers-reached'
  | 'peer-search-completed'
  | 'sync-started'
  | 'already-in-sync'
  | 'sync-completed'
  | 'sync-progress'
  | 'sync-failed'
  | 'block-received'
  | 'validating-block'
  | 'block-rejected'
  | 'block-validated'
  | 'peer-rotation'
  | 'peer-incompatible'
  | 'connection-timeout'
  | 'misbehavior'
  | 'catch-up-chain'
  | 'duplicate'
  | 'duplicate-orphan'
  | 'future-consensus-change'
  | 'removing-incompatible-blocks'
  | 'removing-incompatible-blocks-completed'
  | 'difficulty-adjustment'
  | 'halving';

export type NodeEventState = 'pending' | 'completed' | 'failed';

// Interface para o log de eventos
export interface NodeEvent {
  minerId?: number;
  timestamp: number;
  type: NodeEventType;
  data: any;
  logs: NodeEventLog[];
  state: NodeEventState;
}

export interface NodeEventLog {
  type: EventLogType;
  timestamp?: number;
  data?: any;
}

export class EventManager {
  static log(event: NodeEvent, logType: EventLogType, data?: any) {
    const log: NodeEventLog = {
      type: logType,
      timestamp: Date.now(),
      data,
    };

    event.logs.push(log);

    return log;
  }

  static complete(event: NodeEvent) {
    event.state = 'completed';
  }

  static fail(event: NodeEvent) {
    event.state = 'failed';
  }

  static pending(event: NodeEvent) {
    event.state = 'pending';
  }
}

export type NodeEventLogReasons =
  | 'invalid-unknown'
  | 'invalid-parent'
  | 'duplicate'
  | 'invalid-size'
  | 'invalid-transaction-count'
  | 'invalid-bits'
  | 'invalid-timestamp'
  | 'invalid-hash'
  | 'invalid-target'
  | 'block-not-found'
  | 'consensus-incompatible'
  | 'invalid-transaction'
  | 'invalid-transaction-fee';

export const EVENT_LOG_REASONS: Record<NodeEventLogReasons, string> = {
  'invalid-unknown': 'Bloco rejeitado por razão não identificada',
  duplicate: 'Bloco duplicado',
  'invalid-parent': 'Bloco anterior não encontrado',
  'invalid-timestamp': 'Bloco com timestamp inválido',
  'invalid-transaction-count': 'Bloco com contagem de transações inválida',
  'invalid-hash': 'Bloco com hash inválido',
  'invalid-size': 'Bloco com tamanho inválido',
  'invalid-bits': 'Bloco com dificuldade inválida',
  'invalid-target': 'Bloco com alvo inválido',
  'invalid-transaction-fee': 'Bloco com taxa de transação inválida',
  'block-not-found': 'Bloco não encontrado',
  'consensus-incompatible': 'Consenso incompatível',
  'invalid-transaction': 'Transação inválida',
};
