import { EventLogType } from '../../../../models/event-log.model';

export interface EventLogVisual {
  color: string; // classe CSS
  icon: string; // PrimeIcons class, ex: 'pi pi-check-circle'
  label: string;
  template?: string; // template com placeholders para interpolação
}

export const EVENT_LOG_VISUAL_MAP: Record<EventLogType, EventLogVisual> = {
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
  'block-rejected': {
    color: 'text-red-500',
    icon: 'pi pi-times-circle',
    label: 'Bloco rejeitado',
  },
  'block-validated': {
    color: 'text-green-500',
    icon: 'pi pi-check-circle',
    label: 'Bloco validado',
  },
  'peer-rotation': {
    color: 'text-orange-400',
    icon: 'pi pi-sync',
    label: 'Rotação de peers',
    template: 'Peer #{{peerId}} desconectado por rotação',
  },
};
