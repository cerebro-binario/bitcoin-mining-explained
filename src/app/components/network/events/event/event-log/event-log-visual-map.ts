import {
  EventLogType,
  NodeEventType,
} from '../../../../../models/event-log.model';

export interface EventLogVisual {
  color: string; // classe CSS
  icon: string; // PrimeIcons class, ex: 'pi pi-check-circle'
  label: string;
  template?: string; // template com placeholders para interpolação
}

export const EVENT_LOG_VISUAL_MAP: Record<
  EventLogType | NodeEventType,
  EventLogVisual
> = {
  'peer-found': {
    color: 'text-blue-400',
    icon: 'pi pi-search',
    label: 'Peer encontrado',
    template: 'Peer #{{peerId}} encontrado',
  },
  'peer-connected': {
    color: 'text-green-500',
    icon: 'pi pi-link',
    label: 'Peer conectado',
    template: 'Conectado ao peer #{{peerId}}',
  },
  'max-peers-reached': {
    color: 'text-yellow-400',
    icon: 'pi pi-exclamation-triangle',
    label: 'Máximo de peers atingido',
    template: 'Máximo de peers atingido ({{maxPeers}})',
  },
  'peer-search-completed': {
    color: 'text-blue-400',
    icon: 'pi pi-globe',
    label: 'Busca concluída',
    template:
      'Busca concluída: {{peersFound}} encontrados, {{peersConnected}} conectados',
  },
  'sync-started': {
    color: 'text-yellow-400',
    icon: 'pi pi-refresh',
    label: 'Sincronização iniciada',
    template: 'Sincronização iniciada com peer #{{peerId}}',
  },
  'already-in-sync': {
    color: 'text-green-400',
    icon: 'pi pi-check',
    label: 'Já sincronizado',
    template: 'Já sincronizado com peer #{{peerId}}',
  },
  'sync-completed': {
    color: 'text-green-400',
    icon: 'pi pi-check',
    label: 'Sincronização concluída',
    template: 'Sincronização concluída com peer #{{peerId}}',
  },
  'sync-failed': {
    color: 'text-red-500',
    icon: 'pi pi-times-circle',
    label: 'Sincronização falhou',
    template: 'Sincronização falhou {{reason}}',
  },
  'sync-progress': {
    color: 'text-yellow-400',
    icon: 'pi pi-spinner',
    label: 'Sincronizando',
    template: 'Sincronizando e validando {{nMissingBlocks}} blocos',
  },
  'validating-block': {
    color: 'text-blue-400',
    icon: 'pi pi-cog',
    label: 'Validando bloco',
  },
  duplicate: {
    color: 'text-amber-400',
    icon: 'pi pi-exclamation-triangle',
    label: 'Bloco já recebido (ignorando...)',
  },
  'duplicate-orphan': {
    color: 'text-amber-400',
    icon: 'pi pi-exclamation-triangle',
    label: 'Bloco órfão já recebido (ignorando...)',
  },
  'block-rejected': {
    color: 'text-red-500',
    icon: 'pi pi-times-circle',
    label: 'Bloco rejeitado ({{reason}})',
  },
  'block-validated': {
    color: 'text-green-500',
    icon: 'pi pi-check-circle',
    label: 'Bloco validado',
  },
  'block-mined': {
    color: 'text-orange-400',
    icon: 'pi pi-bolt',
    label: 'Bloco minerado',
    template: 'Bloco #{{block.height}} minerado',
  },
  'block-received': {
    color: 'text-blue-400',
    icon: 'pi pi-download',
    label: 'Bloco recebido [peer #{{peerId}}]',
  },
  'peer-requested-connection': {
    color: 'text-blue-400',
    icon: 'pi pi-user-plus',
    label: 'Peer solicitando conexão [peer #{{peerId}}]',
  },
  'peer-disconnected': {
    color: 'text-red-500',
    icon: 'pi pi-ban',
    label: 'Peer desconectado [peer #{{peerId}}] {{reason}}',
  },
  'peer-rotation': {
    color: 'text-orange-400',
    icon: 'pi pi-sync',
    label: 'Rotação de peers',
    template: 'Peer #{{peerId}} desconectado por rotação',
  },
  'peer-search': {
    color: 'text-blue-400',
    icon: 'pi pi-search',
    label: 'Busca por peers',
    template: 'Buscando por peers',
  },
  'peer-incompatible': {
    color: 'text-red-500',
    icon: 'pi pi-exclamation-triangle',
    label: 'Peer incompatível',
    template: 'Peer #{{peerId}} incompatível',
  },
  'connection-timeout': {
    color: 'text-red-500',
    icon: 'pi pi-times-circle',
    label: 'Conexão expirada',
    template: 'Conexão com peer #{{peerId}} expirada',
  },
  misbehavior: {
    color: 'text-red-500',
    icon: 'pi pi-exclamation-triangle',
    label: 'Comportamento inadequado',
    template: 'Peer #{{peerId}} desconectado por comportamento inadequado',
  },
  'catch-up-chain': {
    color: 'text-blue-400',
    icon: 'pi pi-sync',
    label: 'Sincronização de catch-up',
    template: 'Iniciando sincronização de catch-up',
  },
  'consensus-change': {
    color: 'text-orange-400',
    icon: 'pi pi-sync',
    label: 'Atualização de consenso',
    template:
      'Consenso alterado de v{{oldConsensus.version}} para v{{newConsensus.version}}',
  },
  'removing-incompatible-blocks': {
    color: 'text-yellow-400',
    icon: 'pi pi-trash',
    label: 'Removendo blocos incompatíveis',
    template: 'Removendo blocos incompatíveis com v{{newConsensus.version}}',
  },
  'removing-incompatible-blocks-completed': {
    color: 'text-green-400',
    icon: 'pi pi-check',
    label: 'Blocos incompatíveis removidos',
  },
  'future-consensus-change': {
    color: 'text-yellow-400',
    icon: 'pi pi-exclamation-triangle',
    label:
      'As regras entram em vigor no bloco #{{blockHeight}} (faltam {{nBlocksToGo}} blocos)',
  },
  'difficulty-adjustment': {
    color: 'text-purple-400',
    icon: 'pi pi-chart-line',
    label: 'Ajuste de Dificuldade',
    template:
      'Dificuldade ajustada: {{oldDifficulty}} -> {{newDifficulty}} (fator: {{adjustmentFactor}}x)',
  },
  halving: {
    color: 'text-orange-400',
    icon: 'pi pi-percentage',
    label: 'Halving',
    template:
      'Halving: Recompensa reduzida pela metade: {{oldSubsidy}} -> {{newSubsidy}} BTC',
  },
  'transaction-added': {
    color: 'text-green-400',
    icon: 'pi pi-plus',
    label: 'Transação adicionada',
    template: 'Transação adicionada',
  },
  'transaction-added-details': {
    color: 'text-green-400',
    icon: 'pi pi-plus',
    label: 'Transação adicionada',
    template:
      'Inputs: {{inputs}} | Outputs: {{outputs}} | Valor: {{value}} BTC',
  },
  'transactions-synced': {
    color: 'text-green-400',
    icon: 'pi pi-check',
    label: 'Transações sincronizadas',
    template: 'Transações sincronizadas com peer #{{peerId}}',
  },
  'transaction-received': {
    color: 'text-blue-400',
    icon: 'pi pi-download',
    label: 'Transação recebida',
    template: 'Transação recebida de peer #{{peerId}}',
  },
  'invalid-transaction': {
    color: 'text-red-500',
    icon: 'pi pi-times-circle',
    label: 'Transação inválida',
    template: 'Transação inválida: {{reason}}',
  },
  'duplicate-transaction': {
    color: 'text-amber-400',
    icon: 'pi pi-exclamation-triangle',
    label: 'Transação já recebida (ignorando...)',
  },
};
