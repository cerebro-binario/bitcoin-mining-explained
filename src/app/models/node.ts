import * as CryptoJS from 'crypto-js';
import { pipe, Subject, Subscription } from 'rxjs';
import { delay, filter, tap } from 'rxjs/operators';
import { Block, BlockNode, Transaction } from './block.model';
import { ConsensusVersion, DEFAULT_CONSENSUS } from './consensus.model';
import {
  EVENT_LOG_REASONS,
  EventLogType,
  EventManager,
  NodeEvent,
  NodeEventLog,
  NodeEventLogReasons,
  NodeEventType,
} from './event-log.model';

export interface Neighbor {
  latency: number;
  node: Node;
  connectedAt: number;
}

export class Node {
  private readonly INITIAL_NBITS = 0x1e9fffff;
  private readonly SUBSIDY = 50 * 100000000; // 50 BTC em satoshis
  private readonly HALVING_INTERVAL = 210000; // Blocos até próximo halving
  private readonly MAX_PEERS: number = Math.floor(Math.random() * 2) + 2; // Random between 2 and 3

  peerSearchInterval: number = 60000; // 1 minute
  lastPeerSearch: number = 0;
  isSearchingPeers: boolean = false;

  isSyncing: boolean = false;
  pendingBlocks: Block[] = [];
  isAddingBlock: boolean = false;

  // Log de eventos de propagação/validação de blocos
  events: NodeEvent[] = [];

  // Rastreamento de peers durante o sync inicial
  syncPeers: {
    nodeId: number;
    latency: number;
    status: 'pending' | 'validating' | 'valid' | 'invalid';
    blockchainLength?: number;
    work?: number;
  }[] = [];

  id: number = 0;
  peers: Neighbor[] = [];

  // Campos para minerador
  isMiner: boolean = false;
  name: string = '';
  hashRate: number | null = null;
  currentHashRate: number = 0; // Hash rate real sendo alcançado
  private hashCount: number = 0;
  private lastHashRateUpdate: number = 0;
  currentBlock?: Block;
  isMining: boolean = false;
  miningAddress: string = ''; // Endereço para receber recompensas de mineração

  // Cronômetro de mineração
  miningLastHashTime: number | null = null;
  miningLastTickTime: number | null = null;
  miningElapsed: number = 0;

  // Blockchain local do nó
  genesis?: BlockNode;

  // Estrutura para organizar blocos por altura
  heights: BlockNode[][] = [];

  // Estrutura para rastrear blocos em fork ativamente
  activeFork?: number; // height -> blocos em fork
  lastMainBlocks: Block[] = [];
  activeForkHeights: number[] = [];

  // Se o miner está colapsado
  isCollapsed = false;
  isMaximized = false;
  isLogsMaximized = false;

  // Parâmetros de consenso do nó
  consensus: ConsensusVersion = DEFAULT_CONSENSUS;

  blockBroadcast$ = new Subject<Block>();
  private peerBlockSubscriptions: { [peerId: number]: Subscription } = {};
  private orphanBlocks: Map<string, Block[]> = new Map(); // chave: previousHash, valor: blocos órfãos que dependem desse hash

  private blockBroadcastPipe = (peer: Node) =>
    pipe(
      filter((block: Block) => this.onPeerBlockFiltering(block, peer)),
      delay((Math.floor(Math.random() * 3) + 1) * 1000),
      tap((block: Block) => this.onPeerBlockProcessing(block, peer)),
      tap((block: Block) => this.onPeerBlockProcessingComplete(block, peer))
    );

  // Adiciona campo de misbehavior para cada peer
  misbehaviorScores: { [peerId: number]: number } = {};
  static MISBEHAVIOR_THRESHOLD = 250;
  static MISBEHAVIOR_BLOCK_INVALID = 50;

  // Mapa para rastrear broadcasts: blockHash -> Set<nodeId>
  private blockReceivedHistory: Map<string, Set<number>> = new Map();
  // TTL para limpeza automática (24 horas em ms)
  private readonly HISTORY_TTL = 2 * 60 * 1000;
  // Mapa para rastrear quando o broadcast foi feito
  private blockReceivedTimestamps: Map<string, number> = new Map();

  private readonly CONNECTION_TTL = 1 * 60 * 1000; // 5 minutos em ms

  constructor(init?: Partial<Node>) {
    Object.assign(this, init);
  }

  addBlock(block: Block): NodeEventLogReasons | undefined {
    const blockNode = new BlockNode(block);

    if (!this.heights.length) {
      const originBlock = new Block({
        id: -1,
        height: -1,
        timestamp: 0,
        previousHash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        transactions: [],
        nBits: 0,
        nonce: 0,
        miningElapsed: 0,
        minerId: this.id,
        consensusVersion: this.consensus.version,
      });
      const originNode = new BlockNode(originBlock);
      this.heights.unshift([originNode]);
      this.genesis = originNode;
    }

    // Busca otimizada do pai: só procura em height - 1
    const parentNode = this.findParentNode(block);
    if (!parentNode) return 'invalid-parent';

    // Encontra a altura correta para inserir
    const heightIndex = this.getHeightIndex(block.height);
    const height = this.heights[heightIndex];

    // Verifica se o bloco já existe na altura
    if (height?.find((n) => n.block.hash === blockNode.block.hash)) {
      return 'duplicate';
    }

    // Tudo certo até aqui, marca o bloco como pai
    blockNode.parent = parentNode;

    // Adiciona como filho
    if (
      !parentNode.children.find((n) => n.block.hash === blockNode.block.hash)
    ) {
      parentNode.children.push(blockNode);
    }

    // Se a altura não existe, cria um novo array
    if (heightIndex < 0) {
      this.heights.unshift([blockNode]);
    } else if (!this.heights[heightIndex]) {
      this.heights[heightIndex] = [blockNode];
    } else {
      this.heights[heightIndex].push(blockNode);
    }

    // Log de bloco minerado localmente
    if (block.minerId === this.id) {
      const event = this.addEvent('block-mined', { block });
      EventManager.complete(event);
    }

    this.checkForksAndSort();

    this.updateMiniBlockchain();

    return undefined;
  }

  initBlockTemplate(lastBlock?: Block): Block {
    const timestamp = Date.now();
    const previousHash =
      lastBlock?.hash ||
      '0000000000000000000000000000000000000000000000000000000000000000';
    // Calcula o nBits correto para o novo bloco
    const nBits = this.calculateExpectedNBits(
      lastBlock ? lastBlock.height + 1 : 0
    );
    const blockHeight = lastBlock ? lastBlock.height + 1 : 0;
    const subsidy = this.calculateBlockSubsidy(blockHeight);

    // Cria a transação coinbase
    const coinbaseTx: Transaction = {
      id: CryptoJS.SHA256(timestamp.toString()).toString(),
      inputs: [], // Coinbase não tem inputs
      outputs: [
        {
          value: subsidy,
          scriptPubKey: this.miningAddress,
        },
      ],
      signature: '', // Coinbase não precisa de assinatura
    };

    // Adiciona a coinbase como primeira transação
    const transactions = [coinbaseTx];

    this.currentBlock = new Block({
      id: blockHeight,
      height: blockHeight,
      timestamp,
      previousHash,
      transactions,
      nBits,
      nonce: 0,
      hash: '',
      miningElapsed: 0,
      consensusVersion:
        this.consensus.getConsensusForHeight(blockHeight).version,
    });

    return this.currentBlock;
  }

  // Calcula o valor esperado de nBits para um dado height, seguindo a política de ajuste de dificuldade
  // Permite passar um resolvedor de blocos para seguir a cadeia do bloco recebido
  private calculateExpectedNBits(
    height: number,
    blockResolver?: (hash: string) => Block | undefined,
    tipBlock?: Block
  ): number {
    // Se for o bloco gênese, retorna o valor inicial
    if (height === 0) {
      return this.INITIAL_NBITS;
    }

    // Obtém os parâmetros de consenso para a altura específica
    const epoch = this.consensus.getConsensusForHeight(height - 1);
    const consensus = epoch.parameters;
    const interval = consensus.difficultyAdjustmentInterval;
    const targetBlockTime = consensus.targetBlockTime; // em segundos
    const adjustedHeight = height - epoch.startHeight;

    // Se não for um bloco de ajuste, mantém o nBits do bloco anterior
    if (adjustedHeight % interval !== 0) {
      let lastBlock: Block | undefined;
      if (blockResolver && tipBlock) {
        lastBlock = blockResolver(tipBlock.previousHash);
      } else {
        const lastBlockNode = this.heights
          .flat()
          .find((n) => n.block.height === height - 1 && n.isActive);
        lastBlock = lastBlockNode?.block;
      }
      if (!lastBlock) {
        return this.INITIAL_NBITS;
      }
      return lastBlock.nBits;
    }

    // Encontra o bloco do último ajuste
    const prevAdjustmentHeight = height - interval;
    let prevAdjustmentBlock: Block | undefined;
    let lastBlock: Block | undefined;
    if (blockResolver && tipBlock) {
      prevAdjustmentBlock = this.getAncestorBlock(
        tipBlock,
        prevAdjustmentHeight,
        blockResolver
      );
      lastBlock = blockResolver(tipBlock.previousHash);
    } else {
      const prevAdjustmentNode = this.heights
        .flat()
        .find((n) => n.block.height === prevAdjustmentHeight && n.isActive);
      prevAdjustmentBlock = prevAdjustmentNode?.block;
      const lastBlockNode = this.heights
        .flat()
        .find((n) => n.block.height === height - 1 && n.isActive);
      lastBlock = lastBlockNode?.block;
    }
    if (!prevAdjustmentBlock || !lastBlock) {
      return this.INITIAL_NBITS;
    }

    const actualTime = lastBlock.timestamp - prevAdjustmentBlock.timestamp; // ms
    const expectedTime = interval * targetBlockTime * 1000; // ms

    // Converte o nBits anterior para target
    const prevTarget = Number(prevAdjustmentBlock.target);

    // Calcula o fator de ajuste baseado no tempo real x tempo alvo
    let adjustmentFactor = actualTime / expectedTime;

    // Limita o fator de ajuste para evitar mudanças bruscas (ex: 4x para cima/baixo)
    adjustmentFactor = Math.max(0.25, Math.min(adjustmentFactor, 4));

    // Aplica o fator de ajuste ao target
    let newTarget = Math.round(prevTarget * adjustmentFactor);

    // Converte o target de volta para nBits
    const newNBits = this.targetToNBits(newTarget);

    return newNBits;
  }

  // Converte um target para nBits
  private targetToNBits(target: number): number {
    // Encontra o número de bytes necessários para representar o target
    const targetHex = target.toString(16);
    const targetBytes = Math.ceil(targetHex.length / 2);

    // O primeiro byte é o número de bytes significativos
    const significantBytes = targetBytes;

    // Os próximos 3 bytes são os bytes mais significativos do target
    const significantBits = targetHex.slice(0, 6);

    // Combina os bytes para formar o nBits
    return parseInt(significantBytes.toString(16) + significantBits, 16);
  }

  private calculateBlockSubsidy(blockHeight: number): number {
    const halvings = Math.floor(blockHeight / this.HALVING_INTERVAL);
    return Math.floor(this.SUBSIDY / Math.pow(2, halvings));
  }

  // Função utilitária para buscar um ancestral seguindo previousHash a partir de um bloco base
  private getAncestorBlock(
    block: Block,
    ancestorHeight: number,
    blockResolver: (hash: string) => Block | undefined
  ): Block | undefined {
    let current: Block | undefined = block;
    while (current && current.height > ancestorHeight) {
      current = blockResolver(current.previousHash);
    }
    return current && current.height === ancestorHeight ? current : undefined;
  }

  // Método para ordenar os blocos, movendo forks mortos para o final
  private sortBlocks(a: BlockNode, b: BlockNode): number {
    // 1. Prioriza forks ativos
    if (a.isActive !== b.isActive) {
      return !a.isActive ? 1 : -1;
    }

    // 2. Se ambos são forks ativos ou ambos são dead forks, compara latência
    const aMinerId = a.block.minerId;
    const bMinerId = b.block.minerId;
    let latencyA = Number.POSITIVE_INFINITY;
    let latencyB = Number.POSITIVE_INFINITY;

    // Se o minerId for igual ao do próprio nó, latência é 0 (prioriza a própria chain)
    if (
      aMinerId !== undefined &&
      this.id !== undefined &&
      aMinerId === this.id
    ) {
      latencyA = 0;
    } else if (this.id !== undefined && aMinerId !== undefined) {
      const neighbor = this.peers.find((n) => n.node.id === aMinerId);
      if (neighbor) latencyA = neighbor.latency;
    }

    if (
      bMinerId !== undefined &&
      this.id !== undefined &&
      bMinerId === this.id
    ) {
      latencyB = 0;
    } else if (this.id !== undefined && bMinerId !== undefined) {
      const neighbor = this.peers.find((n) => n.node.id === bMinerId);
      if (neighbor) latencyB = neighbor.latency;
    }

    if (latencyA !== latencyB) {
      return latencyA - latencyB;
    }

    // 3. Se ainda empatar, prioriza o minerId igual ao do próprio nó
    if (aMinerId === this.id && bMinerId !== this.id) return -1;
    if (bMinerId === this.id && aMinerId !== this.id) return 1;

    // 4. Se ainda empatar, mantém a ordem original
    return 0;
  }

  private checkForksAndSort() {
    if (this.heights.length === 0) return;

    const heightsToReorder = new Set<number>();

    this.heights.forEach((height, heightIndex) => {
      if (heightIndex === 0) return;

      height.forEach((block) => {
        if (
          block.children.length === 0 ||
          block.children.every((c) => !c.isActive)
        ) {
          block.isActive = false;
          heightsToReorder.add(heightIndex);
          //   this.markAsDeadFork(block, heightsToReorder, heightIndex);
        } else {
          block.isActive = true;
        }
      });
    });

    // Passo 2: Reordenar todos os heights afetados
    heightsToReorder.forEach((height) => {
      this.heights[height] = this.heights[height].sort(
        this.sortBlocks.bind(this)
      );
    });

    // Passo 3: Reordenar também os arrays `next[]` dentro de cada bloco
    this.heights.forEach((blocks) => {
      blocks.forEach((block) => {
        block.children.sort(this.sortBlocks.bind(this));
      });
    });
  }

  // Método centralizado para calcular o índice na estrutura heights (ordem inversa)
  getHeightIndex(height: number): number {
    const lastIndex = this.heights.length - 1;
    if (
      this.heights.length > 0 &&
      this.heights[lastIndex][0]?.block.height === -1
    ) {
      return this.heights.length - height - 2;
    }
    return this.heights.length - height - 1;
  }

  private findParentNode(block: Block): BlockNode | undefined {
    const heightIndex = this.getHeightIndex(block.height - 1);
    const parent = this.heights[heightIndex]?.find(
      (h) => h.block.hash === block.previousHash
    );
    return parent;
  }

  // Retorna o bloco mais recente usando a estrutura heights
  getLatestBlock(): Block | undefined {
    if (!this.heights.length) return undefined;

    // Percorre as alturas da mais alta para a mais baixa
    for (const height of this.heights) {
      if (height.length > 0 && height[0].block.height !== -1) {
        // Retorna o primeiro bloco da altura mais alta, ignorando o origin block
        return height[0].block;
      }
    }

    return undefined;
  }

  // Reconstrói o array heights a partir do gênesis
  rebuildHeightsFromGenesis() {
    if (!this.genesis) {
      this.heights = [];
      return;
    }
    // Percorre a main chain do gênesis até o topo
    const heights: BlockNode[][] = [];
    let height: BlockNode[] = [this.genesis];
    while (height.length > 0) {
      heights.unshift(height);
      height.forEach((block) => {
        block.children = block.children.filter((child) => child.isActive);
      });
      // Avança para o próximo bloco na main chain (primeiro filho)
      height = height.flatMap((block) => block.children);
    }
    this.heights = heights;
  }

  // Método para incrementar o contador de hashes
  incrementHashCount() {
    this.hashCount++;
    this.updateCurrentHashRate();
  }

  // Método para atualizar o hash rate real
  private updateCurrentHashRate() {
    const now = Date.now();
    if (now - this.lastHashRateUpdate >= 1000) {
      this.currentHashRate = this.hashCount;
      this.hashCount = 0;
      this.lastHashRateUpdate = now;
    }
  }

  private updateMiniBlockchain() {
    this.updateLastMainBlocks();
    this.updateActiveForkHeights();
  }

  // Retorna os últimos 5 blocos da main chain (excluindo o origin fake block)
  private updateLastMainBlocks() {
    const blocks = [];
    let current = this.getLatestBlock();
    let count = 0;
    while (current && current.height >= 0 && count < 5) {
      blocks.unshift(current);
      // Encontra o bloco anterior na main chain
      const prevHash = current.previousHash;
      const prevNode = this.heights
        .flat()
        .find((n) => n.block.hash === prevHash);
      current = prevNode?.block;
      count++;
    }
    this.lastMainBlocks = blocks;
  }

  // Retorna as alturas dos forks ativos entre os últimos 5 blocos
  private updateActiveForkHeights() {
    const forkHeights: number[] = [];
    for (const nodes of this.heights) {
      const activeBlocks = nodes.filter((n) => n.isActive);
      if (activeBlocks.length > 1) {
        const height = nodes[0].block.height;
        if (height >= 0) forkHeights.push(height);
      }
    }
    this.activeForkHeights = forkHeights;
  }

  // Update the difficulty adjustment interval based on block height
  private getDifficultyAdjustmentInterval(height: number): number {
    const epoch = this.consensus.getConsensusForHeight(height);
    if (!epoch) {
      throw new Error(`No consensus parameters found for height ${height}`);
    }
    return epoch.parameters.difficultyAdjustmentInterval;
  }

  private getCurrentConsensusParameters(): ConsensusVersion {
    return this.consensus.getConsensusForHeight(this.currentBlock?.height || 0);
  }

  // Método para validar um bloco individual
  private validateBlock(
    block: Block,
    height: number,
    previousBlock?: Block
  ): boolean {
    const reason = this.validateBlockConsensus(block);
    if (reason) {
      // TODO: adicionar evento de bloco rejeitado
      return false;
    }
    return true;
  }

  // Método para validar uma blockchain inteira
  validateBlockchain(blockchain: BlockNode): boolean {
    let current: BlockNode | undefined = blockchain;
    let previousBlock: Block | undefined;
    let height = -1;

    while (current) {
      const block = current.block;

      if (!this.validateBlock(block, height, previousBlock)) {
        return false;
      }

      previousBlock = block;
      current = current.children[0]; // Pega o primeiro filho (main chain)
      height++;
    }

    return true;
  }

  // Calcula o trabalho acumulado de uma blockchain
  calculateChainWork(blockchain: BlockNode): number {
    let work = 0;
    let current: BlockNode | undefined = blockchain;

    while (current) {
      // O trabalho é inversamente proporcional ao target
      work += 1 / Number(current.block.target);
      current = current.children[0];
    }

    return work;
  }

  // Função utilitária para escolher o vizinho a ser desconectado
  private pickEvictionCandidate(neighbors: Neighbor[]): Neighbor {
    if (neighbors.length === 1) return neighbors[0];

    // Primeiro critério: conexões mais antigas
    const now = Date.now();
    const oldestConnections = neighbors.filter(
      (n) => now - n.connectedAt > this.CONNECTION_TTL * 0.8 // 80% do TTL
    );

    if (oldestConnections.length > 0) {
      return oldestConnections[0];
    }

    // Segundo critério: maior número de conexões
    const maxPeers = Math.max(...neighbors.map((n) => n.node.peers.length));
    const candidates = neighbors.filter(
      (n) => n.node.peers.length === maxPeers
    );

    // Se só há um, retorna ele; senão, escolhe aleatoriamente entre eles
    if (candidates.length === 1) return candidates[0];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private connectToPeerWithEviction(
    peer: Node,
    latency: number = 50,
    event: NodeEvent
  ) {
    const peerEvent = peer.addEvent('peer-requested-connection', {
      peerId: this.id,
    });

    // Se o peer já está cheio, desconecta o vizinho mais "popular" dele
    if (peer.peers.length >= peer.MAX_PEERS) {
      const toDrop = this.pickEvictionCandidate(peer.peers);
      peer.disconnectFromPeer(toDrop.node, {
        ref: peerEvent,
        logType: 'peer-rotation',
      });
      toDrop.node.disconnectFromPeer(peer, undefined, {
        eventType: 'peer-disconnected',
        logType: 'peer-rotation',
      });
    }

    // Só conecta se ainda não estiver conectado
    if (!this.peers.some((n) => n.node.id === peer.id)) {
      const neighbor = {
        node: peer,
        latency,
        connectedAt: Date.now(), // Adiciona timestamp da conexão
      };
      this.peers.push(neighbor);

      EventManager.log(event, 'peer-connected', { peerId: peer.id });

      if (!this.peerBlockSubscriptions[peer.id!]) {
        this.peerBlockSubscriptions[peer.id!] = peer.blockBroadcast$
          .pipe(this.blockBroadcastPipe(peer))
          .subscribe();
      }

      this.syncWith(peer, event);
    }

    if (!peer.peers.some((n) => n.node.id === this.id)) {
      const neighbor = {
        node: this,
        latency,
        connectedAt: Date.now(), // Adiciona timestamp da conexão
      };
      peer.peers.push(neighbor);

      EventManager.log(peerEvent, 'peer-connected', { peerId: this.id });

      if (!peer.peerBlockSubscriptions[this.id!]) {
        peer.peerBlockSubscriptions[this.id!] = this.blockBroadcast$
          .pipe(peer.blockBroadcastPipe(this))
          .subscribe();
      }

      peer.syncWith(this, peerEvent);
      EventManager.complete(peerEvent);
    }
  }

  // Desconecta de um peer: remove dos neighbors e faz unsubscribe
  private disconnectFromPeer(
    peer: Node,
    event?: {
      ref: NodeEvent;
      logType: EventLogType;
      reason?: string;
    },
    newEvent?: {
      eventType: NodeEventType;
      logType: EventLogType;
      reason?: string;
    }
  ) {
    this.peerBlockSubscriptions[peer.id!]?.unsubscribe();
    delete this.peerBlockSubscriptions[peer.id!];

    // Remove o peer da lista de vizinhos deste nó
    this.peers = this.peers.filter((n) => n.node.id !== peer.id);

    if (event) {
      EventManager.log(event.ref, event.logType, {
        peerId: peer.id,
        reason: event.reason,
      });
    } else if (newEvent) {
      const eventType = newEvent.eventType || 'peer-disconnected';
      const logs = [
        {
          type: newEvent.logType,
          timestamp: Date.now(),
          data: { peerId: peer.id },
        },
      ];

      const disconnectEvent = this.addEvent(
        eventType,
        {
          peerId: peer.id,
        },
        logs
      );
      EventManager.complete(disconnectEvent);
    }
  }

  private syncWith(peer: Node, event: NodeEvent) {
    EventManager.log(event, 'sync-started', { peerId: peer.id });

    const latestForks = peer.heights[0] || [];
    for (const fork of latestForks) {
      this.catchUpChain(fork.block, peer, event);
    }

    if (latestForks.length === 0) {
      EventManager.log(event, 'already-in-sync', {
        peerId: peer.id,
      });
    }

    EventManager.log(event, 'sync-completed', { peerId: peer.id });
  }

  // Método centralizado para processar um bloco recebido
  private processBlock(
    block: Block,
    peer: Node,
    event: NodeEvent
  ): NodeEventLogReasons | undefined {
    const lastLogType = event.logs[event.logs.length - 1]?.type || event.type;
    // Não mostrar o bloco se o último log for block-received (já foi mostrado)
    const showBlock = lastLogType !== 'block-received' ? block : undefined;

    EventManager.log(event, 'validating-block', {
      peerId: peer.id,
      block: showBlock,
    });

    // 4. Validar o bloco
    let reason = this.validateBlockConsensus(block);
    if (reason) {
      this.handleNonConsensualBlock(block, peer, event, reason);
      EventManager.fail(event);
      return reason;
    }

    // Resetar score de misbehavior (se chegou aqui, o bloco foi validado)
    delete this.misbehaviorScores[peer.id!];

    const prevTopBlock = this.getLatestBlock();
    reason = this.addBlock(block);

    if (reason) {
      if (reason === 'duplicate') {
        EventManager.log(event, 'duplicate', {
          block,
          reason: EVENT_LOG_REASONS[reason],
        });
      } else {
        EventManager.log(event, 'block-rejected', {
          block,
          reason: EVENT_LOG_REASONS[reason],
        });
      }

      EventManager.fail(event);
      return reason;
    }

    EventManager.log(event, 'block-validated', {
      peerId: peer?.id,
      block: showBlock,
    });

    EventManager.complete(event);

    // Atualizar current block APENAS se o topo da main chain mudou
    const newTopBlock = this.getLatestBlock();
    if (
      !prevTopBlock ||
      !newTopBlock ||
      newTopBlock.hash !== prevTopBlock.hash
    ) {
      this.initBlockTemplate(newTopBlock);
    }

    return undefined;
  }

  onPeerBlockFiltering(block: Block, peer: Node) {
    // Se o bloco é do próprio minerador, não processa (está recebendo o bloco do próprio minerador do peer)
    if (block.minerId === this.id) {
      return false;
    }

    if (this.hasReceivedFromPeer(block.hash, peer.id)) {
      return false;
    }

    this.markReceived(block.hash, peer.id);

    return true;
  }

  // Handler for when a block is received from a peer
  onPeerBlockProcessing(block: Block, peer: Node) {
    //  Marcar como sincronizando
    this.isSyncing = true;
    //  Log de recebimento do bloco
    const event = this.addEvent('block-received', {
      peerId: peer.id,
      block,
    });

    // Verificar se possui pai antes de validar consenso
    const parent = this.findParentNode(block);
    if (!parent && block.height > 0) {
      this.processOrphan(block, peer, event);
    } else {
      this.processBlock(block, peer, event);
    }

    // Repropagar para outros peers
    this.blockBroadcast$.next(block);
  }

  onPeerBlockProcessingComplete(block: Block, peer: Node) {
    this.isSyncing = false;
  }

  private checkIfBlockExists(block: Block) {
    const heightIndex = this.getHeightIndex(block.height);
    return this.heights[heightIndex]?.some((h) => h.block.hash === block.hash);
  }

  private processOrphan(orphan: Block, peer: Node, event: NodeEvent) {
    // Armazena como órfão e encerra o fluxo
    if (!this.orphanBlocks.has(orphan.previousHash)) {
      this.orphanBlocks.set(orphan.previousHash, []);
    }
    const orphans = this.orphanBlocks.get(orphan.previousHash) || [];

    if (orphans.some((o) => o.hash === orphan.hash)) {
      EventManager.log(event, 'duplicate-orphan', {
        peerId: peer.id,
        block: orphan,
      });
      EventManager.fail(event);
      return;
    }

    this.orphanBlocks.get(orphan.previousHash)!.push(orphan);

    // Log apenas se não for duplicado
    EventManager.log(event, 'block-rejected', {
      peerId: peer.id,
      block: orphan,
      reason: EVENT_LOG_REASONS['invalid-parent'],
    });

    EventManager.log(event, 'catch-up-chain', {
      peerId: peer.id,
      block: orphan,
    });

    this.catchUpChain(orphan, peer, event);

    EventManager.complete(event);
  }

  private handleNonConsensualBlock(
    block: Block,
    peer: Node,
    event: NodeEvent,
    reason: NodeEventLogReasons
  ) {
    EventManager.log(event, 'block-rejected', {
      peerId: peer.id,
      block,
      reason: EVENT_LOG_REASONS[reason],
    });

    // Incrementa score de misbehavior
    if (peer.id !== undefined) {
      if (!this.misbehaviorScores[peer.id]) this.misbehaviorScores[peer.id] = 0;
      this.misbehaviorScores[peer.id] += Node.MISBEHAVIOR_BLOCK_INVALID;
      // Se passou do limite, desconecta
      if (this.misbehaviorScores[peer.id] >= Node.MISBEHAVIOR_THRESHOLD) {
        this.disconnectFromPeer(peer, {
          ref: event,
          logType: 'misbehavior',
        });

        peer.disconnectFromPeer(this, undefined, {
          eventType: 'peer-disconnected',
          logType: 'misbehavior',
        });
      }
    }
  }

  private catchUpChain(orphan: Block, origin: Node, event: NodeEvent) {
    let round = 0;
    const missing: { block: Block; peer: Node }[] = [
      { block: orphan, peer: origin },
    ];
    let completed = false;
    let currentBlock = orphan;
    let notFoundCount = 0;

    while (!completed) {
      const totalPeers = this.peers.length;
      const peer = this.peers[round % totalPeers];
      round++;

      const parentBlock = this.downloadParentBlockFromPeer(
        currentBlock,
        peer.node
      );

      if (!parentBlock) {
        notFoundCount++;

        if (notFoundCount > totalPeers * 5) {
          EventManager.log(event, 'sync-failed', {
            peerId: origin.id,
            reason: `(${EVENT_LOG_REASONS['block-not-found']})`,
          });
          EventManager.fail(event);
          return;
        }

        continue;
      }

      // Resetar contador de blocos não encontrados (se chegou aqui, o bloco foi encontrado)
      notFoundCount = 0;

      completed =
        this.checkIfBlockExists(parentBlock) || parentBlock.height === -1;

      if (completed) {
        break;
      }

      missing.unshift({ block: parentBlock, peer: peer.node });
      currentBlock = parentBlock;
    }

    if (missing.length <= 1) {
      EventManager.log(event, 'already-in-sync', { peerId: origin.id });

      return;
    }

    EventManager.log(event, 'sync-progress', {
      peerId: origin.id,
      nMissingBlocks: missing.length,
    });

    // Ordena os blocos pela altura (ascendente, do mais antigo para o mais recente)
    missing.sort((a, b) => a.block.height - b.block.height);

    for (const { block, peer } of missing) {
      EventManager.log(event, 'block-received', { block, peerId: peer.id });

      const reason = this.processBlock(block, peer, event);

      if (reason) {
        EventManager.log(event, 'sync-failed', {
          block,
          reason: `(${EVENT_LOG_REASONS[reason]})`,
        });
        EventManager.fail(event);
        return;
      }
    }
  }

  private downloadGenesisFromPeer(peer: Node) {
    const heightIndex = peer.getHeightIndex(0);
    return peer.heights[heightIndex]?.map((h) => h.block) || [];
  }

  private downloadBlockFromPeer(height: number, hash: string, peer: Node) {
    const heightIndex = peer.getHeightIndex(height);
    return peer.heights[heightIndex]?.find((h) => h.block.hash === hash)?.block;
  }

  private downloadParentBlockFromPeer(block: Block, peer: Node) {
    const heightIndex = peer.getHeightIndex(block.height - 1);
    return peer.heights[heightIndex]?.find(
      (h) => h.block.hash === block.previousHash
    )?.block;
  }

  // Busca um bloco local por altura
  getBlockByHeight(height: number): Block | null {
    for (const heightArr of this.heights) {
      for (const node of heightArr) {
        if (node.block.height === height) {
          return node.block;
        }
      }
    }
    return null;
  }

  // Busca todos os blocos ativos de uma altura
  getBlocksByHeight(height: number): Block[] {
    const heightIndex = this.getHeightIndex(height);
    return this.heights[heightIndex]?.map((n) => n.block) || [];
  }

  // Método para validação completa do bloco
  private validateBlockConsensus(
    block: Block
  ): NodeEventLogReasons | undefined {
    // 1. Validar tamanho máximo do bloco
    const blockSize = JSON.stringify(block).length;
    const consensus = this.consensus.getConsensusForHeight(block.height);
    const consensusParams = consensus.parameters;
    const maxBlockSizeBytes = consensusParams.maxBlockSize * 1024 * 1024; // Converte MB para bytes
    if (blockSize > maxBlockSizeBytes) {
      return 'invalid-size';
    }

    // 2. Validar número máximo de transações (0 significa sem limite)
    if (
      consensusParams.maxTransactionsPerBlock > 0 &&
      block.transactions.length > consensusParams.maxTransactionsPerBlock
    ) {
      return 'invalid-transaction-count';
    }

    // 3. Validar ajuste de dificuldade (nBits)
    // Para simular o Bitcoin real, use a cadeia do próprio bloco para calcular o nBits esperado
    const blockResolver = (hash: string) => {
      // Procura o bloco na estrutura local (pode ser melhorado para buscar em órfãos, se necessário)
      return this.heights.flat().find((n) => n.block.hash === hash)?.block;
    };
    const expectedNBits = this.calculateExpectedNBits(
      block.height,
      blockResolver,
      block
    );
    if (block.nBits !== expectedNBits) {
      return 'invalid-bits';
    }

    // 4. Validar target time
    const previousBlock = this.getBlockByHeight(block.height - 1);
    if (previousBlock) {
      // Regra Bitcoin: timestamp deve ser maior que a mediana dos últimos 11 blocos
      const medianTimePast = this.getMedianTimePast(block.height);
      if (block.timestamp <= medianTimePast) {
        return 'invalid-timestamp';
      }

      // Verificar se o bloco não está muito no futuro (2 horas)
      const maxFutureTime = Date.now() + 7200000; // 2 horas em milissegundos
      if (block.timestamp > maxFutureTime) {
        return 'invalid-timestamp';
      }
    }

    // 5. Validar hash do bloco
    const calculatedHash = block.calculateHash();
    if (calculatedHash !== block.hash) {
      return 'invalid-hash';
    }

    // 6. Validar se o hash está abaixo do target
    if (!block.isHashBelowTarget()) {
      return 'invalid-target';
    }

    return undefined;
  }

  // Função utilitária para calcular a mediana dos timestamps dos últimos N blocos
  private getMedianTimePast(height: number, window: number = 11): number {
    const timestamps: number[] = [];
    let currentHeight = height - 1;
    while (currentHeight >= 0 && timestamps.length < window) {
      const block = this.getBlockByHeight(currentHeight);
      if (block) {
        timestamps.push(block.timestamp);
      }
      currentHeight--;
    }
    if (timestamps.length === 0) return 0;
    timestamps.sort((a, b) => a - b);
    const mid = Math.floor(timestamps.length / 2);
    if (timestamps.length % 2 === 0) {
      return Math.floor((timestamps[mid - 1] + timestamps[mid]) / 2);
    } else {
      return timestamps[mid];
    }
  }

  async searchPeersToConnect(nodes: Node[]) {
    this.checkPeerConnectionsTTL();

    if (this.peers.length >= this.MAX_PEERS) return;
    if (this.isSearchingPeers) return;

    this.isSearchingPeers = true;

    const searchPeersEvent = this.addEvent('peer-search');

    const searchDelay = 1000 + Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, searchDelay));

    let peersConnected = 0;
    let peersFound = 0;

    const leastPopularNodes = nodes.slice().sort((a, b) => {
      // Primeiro critério: número de conexões (menos conexões = maior prioridade)
      const connectionsDiff = a.peers.length - b.peers.length;
      if (connectionsDiff !== 0) return connectionsDiff;
      // Segundo critério: aleatoriedade para desempatar
      return Math.random() - 0.5;
    });

    for (const peer of leastPopularNodes) {
      if (peer.id === this.id || this.peers.some((n) => n.node.id === peer.id))
        continue;

      peersFound++;

      EventManager.log(searchPeersEvent, 'peer-found', { peerId: peer.id });

      if (this.isPeerConsensusCompatible(peer)) {
        const latency = 3000 + Math.floor(Math.random() * 7001); // 3000-10000ms (3-10 segundos)
        this.connectToPeerWithEviction(peer, latency, searchPeersEvent);
        peersConnected++;

        if (this.peers.length >= this.MAX_PEERS) {
          EventManager.log(searchPeersEvent, 'max-peers-reached', {
            maxPeers: this.MAX_PEERS,
          });
          break;
        }
      } else {
        EventManager.log(searchPeersEvent, 'peer-incompatible', {
          peerId: peer.id,
          reason: EVENT_LOG_REASONS['consensus-incompatible'],
        });
      }
    }

    EventManager.log(searchPeersEvent, 'peer-search-completed', {
      peersFound,
      peersConnected,
    });
    EventManager.complete(searchPeersEvent);

    this.isSearchingPeers = false;
  }

  private checkPeerConnectionsTTL() {
    this.peers.forEach((p) => {
      if (p.connectedAt < Date.now() - this.CONNECTION_TTL) {
        this.disconnectFromPeer(p.node, undefined, {
          eventType: 'peer-disconnected',
          logType: 'connection-timeout',
        });

        p.node.disconnectFromPeer(this, undefined, {
          eventType: 'peer-disconnected',
          logType: 'connection-timeout',
        });
      }
    });
  }

  private isPeerConsensusCompatible(peer: Node): boolean {
    // Obtém a altura atual
    const currentHeight = this.getLatestBlock()?.height || 0;

    return areConsensusVersionsCompatible(
      this.consensus,
      peer.consensus,
      currentHeight
    );
  }

  private addEvent(type: NodeEventType, data?: any, logs: NodeEventLog[] = []) {
    const event: NodeEvent = {
      minerId: this.id,
      type,
      data,
      timestamp: Date.now(),
      logs,
      state: 'pending',
    };
    this.events.unshift(event);
    while (this.events.length > 50) {
      this.events.pop();
    }

    return event;
  }

  private cleanupOldBlockReceivedHistory() {
    const now = Date.now();
    for (const [
      blockHash,
      timestamp,
    ] of this.blockReceivedTimestamps.entries()) {
      if (now - timestamp > this.HISTORY_TTL) {
        this.blockReceivedHistory.delete(blockHash);
        this.blockReceivedTimestamps.delete(blockHash);
      }
    }
  }

  private hasReceivedFromPeer(blockHash: string, peerId: number): boolean {
    const peerSet = this.blockReceivedHistory.get(blockHash);
    return peerSet?.has(peerId) ?? false;
  }

  private markReceived(blockHash: string, peerId: number) {
    this.cleanupOldBlockReceivedHistory();

    if (!this.blockReceivedHistory.has(blockHash)) {
      this.blockReceivedHistory.set(blockHash, new Set());
      this.blockReceivedTimestamps.set(blockHash, Date.now());
    }
    this.blockReceivedHistory.get(blockHash)!.add(peerId);
  }

  private syncCompatibleChainOnConsensusChange(
    newConsensus: ConsensusVersion,
    event: NodeEvent
  ) {
    // Obtém a altura atual
    const currentHeight = this.getLatestBlock()?.height || 0;

    const compatible = areConsensusVersionsCompatible(
      this.consensus,
      newConsensus,
      currentHeight
    );

    // Se as versões são compatíveis (soft fork), apenas atualiza o consenso
    if (compatible) {
      this.consensus = newConsensus;
      return;
    }

    // Se chegou aqui, as versões são incompatíveis (hard fork)

    EventManager.log(event, 'removing-incompatible-blocks', {
      newConsensus,
      oldConsensus: this.consensus,
    });

    // Encontra o ponto de divergência (altura onde o consenso mudou)
    let highestVersion =
      newConsensus.version > this.consensus.version
        ? newConsensus
        : this.consensus;
    const lowestVersion =
      newConsensus.version > this.consensus.version
        ? this.consensus
        : newConsensus;

    // algoritmo para procurar a divergência entre as duas versões
    while (highestVersion.previousVersion?.hash !== lowestVersion.hash) {
      if (highestVersion.previousVersion) {
        highestVersion = highestVersion.previousVersion;
      } else {
        throw new Error('Incompatible consensus versions');
      }
    }

    const divergenceHeight = highestVersion.startHeight;

    // Remove todos os blocos após o ponto de divergência
    const divergenceIndex = this.getHeightIndex(divergenceHeight);
    if (divergenceIndex >= 0) {
      for (let i = 0; i < divergenceIndex; i++) {
        for (let j = 0; j < this.heights[i].length; j++) {
          delete this.heights[i][j];
        }
      }
      this.heights = this.heights.slice(divergenceIndex);
      this.heights[0].forEach((h) => (h.children = []));
    }

    // Atualiza o consenso
    this.consensus = newConsensus;

    EventManager.log(event, 'removing-incompatible-blocks-completed', {
      newConsensus,
      oldConsensus: this.consensus,
    });
  }

  // Método público para mudar o consenso
  changeConsensus(newConsensus: ConsensusVersion) {
    const event = this.addEvent('consensus-change', {
      newConsensus,
      oldConsensus: this.consensus,
    });

    const currentHeight = this.getLatestBlock()?.height || 0;

    // Verificar se nova versão entra em vigência no futuro
    if (newConsensus.startHeight > currentHeight) {
      EventManager.log(event, 'future-consensus-change', {
        blockHeight: newConsensus.startHeight,
        nBlocksToGo: newConsensus.startHeight - currentHeight,
      });
    }

    this.syncCompatibleChainOnConsensusChange(newConsensus, event);
    EventManager.complete(event);
  }
}
