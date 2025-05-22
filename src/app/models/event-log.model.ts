export type NodeEventType =
  | 'block-mined' // Bloco foi minerado
  | 'block-received' // Evento de recebimento de bloco
  | 'peer-search' // Busca por peers
  | 'peer-requested-connection' // Peer solicitou conexão
  | 'peer-disconnected'; // Peer foi desconectado (com razão específica)

export type EventLogType =
  | 'peer-found'
  | 'peer-connected'
  | 'max-peers-reached'
  | 'peer-search-completed'
  | 'sync-started'
  | 'already-in-sync'
  | 'sync-completed'
  | 'sync-progress'
  | 'validating-block'
  | 'block-rejected'
  | 'block-validated'
  | 'peer-rotation';

export type EventState = 'pending' | 'completed' | 'failed';

// Interface para o log de eventos
export interface NodeEvent {
  minerId?: number;
  timestamp: number;
  type: NodeEventType;
  title: string;
  data: any;
  logs: EventLog[];
  state: EventState;
}

export interface EventLog {
  type: EventLogType;
  timestamp?: number;
  data?: any;
}

export const eventTitles: Record<NodeEventType, string> = {
  'block-mined': '⛏️ Bloco minerado',
  'block-received': '⬇️ Bloco recebido',
  'peer-search': '🌐 Busca por peers',
  'peer-requested-connection': '🔗 Peer solicitando conexão',
  'peer-disconnected': '🚫 Peer desconectado',
};

export class EventManager {
  static log(event: NodeEvent, logType: EventLogType, data?: any) {
    const log: EventLog = {
      type: logType,
      timestamp: Date.now(),
      data,
    };

    event.logs.push(log);
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

export const BLOCK_REJECTED_REASONS: Record<string, string> = {
  'duplicate-orphan': 'bloco órfão duplicado',
  'invalid-parent': 'bloco sem pai',
};
