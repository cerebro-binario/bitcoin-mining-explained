import { Block } from './block.model';

export type EventType =
  | 'block-received' // Evento de recebimento de bloco
  | 'block-validated' // Bloco foi validado com sucesso
  | 'block-rejected' // Bloco foi rejeitado (com razão específica)
  | 'sync-progress' // Progresso de sincronização
  | 'block-mined' // Bloco foi minerado
  | 'peer-disconnected' // Peer foi desconectado (com razão específica)
  | 'peer-connected' // Peer foi conectado
  | 'peer-search' // Busca por peers
  | 'peer-search-complete'; // Busca por peers concluída

// Razões específicas para cada tipo de evento
export type EventReason = {
  'block-rejected':
    | 'duplicate'
    | 'invalid-parent'
    | 'invalid-hash'
    | 'invalid-target'
    | 'invalid-timestamp'
    | 'invalid-nbits'
    | 'invalid-subsidy'
    | 'invalid-size'
    | 'invalid-transactions';

  'peer-disconnected': 'misbehavior' | 'disconnection';

  'sync-progress': 'sync-progress' | 'sync-complete';

  // Tipos que não têm razões específicas
  'block-received': never;
  'block-validated': never;
  'block-mined': never;
  'peer-connected': never;
  'peer-search': never;
  'peer-search-complete': never;
};

// Interface para o log de eventos
export interface EventLog {
  type: EventType;
  from?: number;
  block?: Block;
  timestamp?: number;
  reason?: EventReason[EventType]; // Razão específica para o tipo de evento
  message: string;
  data?: {
    processed?: number;
    total?: number;
    blocksPerSecond?: number;
    estimatedTimeRemaining?: number;
    peersFound?: number;
    peersConnected?: number;
    maxPeers?: number;
  };
}

// Mensagens para cada tipo de evento
export const eventMessages: Record<EventType, string> = {
  'block-received': 'Bloco {block.hash} recebido de {from}',
  'block-validated': 'Bloco {block.hash} validado',
  'block-rejected': 'Bloco {block.hash} rejeitado: {reason}',
  'block-mined': 'Bloco {block.hash} minerado',
  'sync-progress': 'Sincronização: {data.processed}/{data.total} blocos',
  'peer-disconnected': 'Peer {from} desconectado: {reason}',
  'peer-connected': 'Peer {from} conectado',
  'peer-search': 'Buscando peers...',
  'peer-search-complete':
    'Busca concluída: {data.peersFound} encontrados, {data.peersConnected} conectados',
};

// Mensagens para cada razão de rejeição
export const rejectionMessages: Record<EventReason['block-rejected'], string> =
  {
    duplicate: 'Bloco duplicado',
    'invalid-parent': 'Bloco órfão: bloco pai não encontrado',
    'invalid-hash': 'Hash do bloco inválido',
    'invalid-target': 'Bloco não atinge o target de dificuldade',
    'invalid-timestamp': 'Timestamp do bloco inválido',
    'invalid-nbits': 'Dificuldade (nBits) do bloco incorreta',
    'invalid-subsidy': 'Subsídio do bloco incorreto',
    'invalid-size': 'Tamanho do bloco excede o limite máximo',
    'invalid-transactions': 'Número de transações excede o limite máximo',
  };

// Mensagens para cada razão de desconexão
export const disconnectMessages: Record<
  EventReason['peer-disconnected'],
  string
> = {
  misbehavior: 'Mau comportamento',
  disconnection: 'Desconectado',
};

// Classe para gerenciar mensagens
export class EventMessageManager {
  static generateMessage(event: Omit<EventLog, 'message'>): string {
    let template = eventMessages[event.type];

    // Substitui placeholders
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      if (key === 'reason') {
        if (event.type === 'block-rejected') {
          return rejectionMessages[
            event.reason as EventReason['block-rejected']
          ];
        }
        if (event.type === 'peer-disconnected') {
          return disconnectMessages[
            event.reason as EventReason['peer-disconnected']
          ];
        }
      }

      const value = key
        .split('.')
        .reduce((obj: any, k: string) => obj?.[k], event);
      return value !== undefined ? value : match;
    });
  }
}
