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

export type BlockRejectedReason =
  | 'invalid-unknown'
  | 'duplicate-orphan'
  | 'invalid-parent'
  | 'invalid-proof-of-work'
  | 'invalid-timestamp'
  | 'invalid-merkle-root'
  | 'invalid-transaction-count'
  | 'invalid-transaction-root'
  | 'invalid-previous-hash'
  | 'invalid-nonce'
  | 'invalid-difficulty'
  | 'invalid-hash'
  | 'invalid-size'
  | 'invalid-version'
  | 'invalid-bits'
  | 'invalid-target'
  | 'invalid-signature'
  | 'invalid-transaction-signature'
  | 'invalid-transaction-hash'
  | 'invalid-transaction-index'
  | 'invalid-transaction-value'
  | 'invalid-transaction-data'
  | 'invalid-transaction-type'
  | 'invalid-transaction-sender'
  | 'invalid-transaction-recipient'
  | 'invalid-transaction-amount'
  | 'invalid-transaction-fee'
  | 'invalid-transaction-data-hash'
  | 'invalid-transaction-recipient-signature'
  | 'invalid-transaction-sender-signature'
  | 'invalid-transaction-recipient-public-key'
  | 'invalid-transaction-sender-public-key'
  | 'invalid-transaction-recipient-address'
  | 'invalid-transaction-sender-address'
  | 'invalid-transaction-recipient-balance'
  | 'invalid-transaction-sender-balance'
  | 'invalid-transaction-recipient-nonce'
  | 'invalid-transaction-sender-nonce'
  | 'invalid-transaction-recipient-address-hash'
  | 'invalid-transaction-sender-address-hash'
  | 'invalid-transaction-recipient-public-key-hash'
  | 'invalid-transaction-sender-public-key-hash'
  | 'invalid-transaction-recipient-signature-hash'
  | 'invalid-transaction-sender-signature-hash';

export const BLOCK_REJECTED_REASONS: Record<BlockRejectedReason, string> = {
  'invalid-unknown': 'Bloco rejeitado por razão não identificada',
  'duplicate-orphan': 'Bloco órfão duplicado',
  'invalid-parent': 'Bloco sem pai',
  'invalid-proof-of-work': 'Bloco com prova de trabalho inválida',
  'invalid-timestamp': 'Bloco com timestamp inválido',
  'invalid-merkle-root': 'Bloco com raiz de merkle inválida',
  'invalid-transaction-count': 'Bloco com contagem de transações inválida',
  'invalid-transaction-root': 'Bloco com raiz de transações inválida',
  'invalid-previous-hash': 'Bloco com hash do bloco anterior inválido',
  'invalid-nonce': 'Bloco com nonce inválido',
  'invalid-difficulty': 'Bloco com dificuldade inválida',
  'invalid-hash': 'Bloco com hash inválido',
  'invalid-size': 'Bloco com tamanho inválido',
  'invalid-version': 'Bloco com versão inválida',
  'invalid-bits': 'Bloco com bits inválidos',
  'invalid-target': 'Bloco com alvo inválido',
  'invalid-signature': 'Bloco com assinatura inválida',
  'invalid-transaction-signature': 'Bloco com assinatura de transação inválida',
  'invalid-transaction-hash': 'Bloco com hash de transação inválido',
  'invalid-transaction-index': 'Bloco com índice de transação inválido',
  'invalid-transaction-value': 'Bloco com valor de transação inválido',
  'invalid-transaction-data': 'Bloco com dados de transação inválidos',
  'invalid-transaction-type': 'Bloco com tipo de transação inválido',
  'invalid-transaction-sender': 'Bloco com remetente de transação inválido',
  'invalid-transaction-recipient':
    'Bloco com destinatário de transação inválido',
  'invalid-transaction-amount': 'Bloco com valor de transação inválido',
  'invalid-transaction-fee': 'Bloco com taxa de transação inválida',
  'invalid-transaction-data-hash':
    'Bloco com hash de dados de transação inválido',
  'invalid-transaction-recipient-signature':
    'Bloco com assinatura de destinatário de transação inválida',
  'invalid-transaction-sender-signature':
    'Bloco com assinatura de remetente de transação inválida',
  'invalid-transaction-recipient-public-key':
    'Bloco com chave pública de destinatário de transação inválida',
  'invalid-transaction-sender-public-key':
    'Bloco com chave pública de remetente de transação inválida',
  'invalid-transaction-recipient-address':
    'Bloco com endereço de destinatário de transação inválido',
  'invalid-transaction-sender-address':
    'Bloco com endereço de remetente de transação inválido',
  'invalid-transaction-recipient-balance':
    'Bloco com saldo de destinatário de transação inválido',
  'invalid-transaction-sender-balance':
    'Bloco com saldo de remetente de transação inválido',
  'invalid-transaction-recipient-nonce':
    'Bloco com nonce de destinatário de transação inválido',
  'invalid-transaction-sender-nonce':
    'Bloco com nonce de remetente de transação inválido',
  'invalid-transaction-recipient-address-hash':
    'Bloco com hash de endereço de destinatário de transação inválido',
  'invalid-transaction-sender-address-hash':
    'Bloco com hash de endereço de remetente de transação inválido',
  'invalid-transaction-recipient-public-key-hash':
    'Bloco com hash de chave pública de destinatário de transação inválido',
  'invalid-transaction-sender-public-key-hash':
    'Bloco com hash de chave pública de remetente de transação inválido',
  'invalid-transaction-recipient-signature-hash':
    'Bloco com hash de assinatura de destinatário de transação inválido',
  'invalid-transaction-sender-signature-hash':
    'Bloco com hash de assinatura de remetente de transação inválido',
};
