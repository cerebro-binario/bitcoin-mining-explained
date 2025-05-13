import * as CryptoJS from 'crypto-js';
import { Subject, Subscription } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Block, BlockNode, Transaction } from './block.model';
import {
  ConsensusEpoch,
  ConsensusParameters,
  ConsensusVersion,
  DEFAULT_CONSENSUS,
} from './consensus.model';
import {
  EventLog,
  validationMessages,
  ValidationType,
} from './event-log.model';

export interface Neighbor {
  latency: number;
  node: Node;
}

export class Node {
  private readonly INITIAL_NBITS = 0x1e9fffff;
  private readonly SUBSIDY = 50 * 100000000; // 50 BTC em satoshis
  private readonly HALVING_INTERVAL = 210000; // Blocos até próximo halving

  isSyncing: boolean = false;
  pendingBlocks: Block[] = [];
  isAddingBlock: boolean = false;

  // Log de eventos de propagação/validação de blocos
  eventLog: EventLog[] = [];

  // Rastreamento de peers durante o sync inicial
  syncPeers: {
    nodeId: number;
    latency: number;
    status: 'pending' | 'validating' | 'valid' | 'invalid';
    blockchainLength?: number;
    work?: number;
  }[] = [];

  id?: number;
  neighbors: Neighbor[] = [];

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
  private receivedBlockHashes = new Set<string>();
  private orphanBlocks: Map<string, Block[]> = new Map(); // chave: previousHash, valor: blocos órfãos que dependem desse hash

  constructor(init?: Partial<Node>) {
    Object.assign(this, init);
  }

  private addEvent(event: Omit<EventLog, 'message'>) {
    const message = event.reason ? validationMessages[event.reason] : undefined;
    this.eventLog.unshift({ ...event, message });
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
      consensusVersion: this.consensus.version,
    });

    return this.currentBlock;
  }

  // Calcula o valor esperado de nBits para um dado height, seguindo a política de ajuste de dificuldade
  calculateExpectedNBits(height: number): number {
    // Obtém os parâmetros de consenso para a altura específica
    const epoch = this.getEpochForHeight(height);
    const consensus = epoch.parameters;
    const interval = consensus.difficultyAdjustmentInterval;
    const targetBlockTime = consensus.targetBlockTime; // em segundos
    const adjustedHeight = height - epoch.startHeight;

    // Se for o bloco gênese, retorna o valor inicial
    if (height === 0) {
      return this.INITIAL_NBITS;
    }

    // Se não for um bloco de ajuste, mantém o nBits do bloco anterior
    if (adjustedHeight % interval !== 0) {
      const lastBlockNode = this.heights
        .flat()
        .find((n) => n.block.height === height - 1 && n.isActive);
      if (!lastBlockNode) {
        return this.INITIAL_NBITS;
      }
      return lastBlockNode.block.nBits;
    }

    // Encontra o bloco do último ajuste
    const prevAdjustmentHeight = height - interval;
    const prevAdjustmentNode = this.heights
      .flat()
      .find((n) => n.block.height === prevAdjustmentHeight && n.isActive);
    const lastBlockNode = this.heights
      .flat()
      .find((n) => n.block.height === height - 1 && n.isActive);
    if (!prevAdjustmentNode || !lastBlockNode) {
      return this.INITIAL_NBITS;
    }

    const actualTime =
      lastBlockNode.block.timestamp - prevAdjustmentNode.block.timestamp; // ms
    const expectedTime = interval * targetBlockTime * 1000; // ms

    // Converte o nBits anterior para target
    const prevTarget = Number(prevAdjustmentNode.block.target);

    // Calcula o fator de ajuste baseado no tempo real x tempo alvo
    let adjustmentFactor = actualTime / expectedTime;

    // Limita o fator de ajuste para evitar mudanças bruscas (ex: 4x para cima/baixo)
    adjustmentFactor = Math.max(0.25, Math.min(adjustmentFactor, 4));

    // Aplica o fator de ajuste ao target
    let newTarget = Math.round(prevTarget * adjustmentFactor);

    // Converte o target de volta para nBits
    const newNBits = this.targetToNBits(newTarget);

    console.log(`Ajuste de dificuldade:
      Altura: ${height}
      Tempo real: ${actualTime}ms
      Tempo esperado: ${expectedTime}ms
      Target anterior: ${prevTarget}
      Target novo: ${newTarget}
      nBits anterior: ${prevAdjustmentNode.block.nBits}
      nBits novo: ${newNBits}
      Fator de ajuste: ${adjustmentFactor}
    `);

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
      const neighbor = this.neighbors.find((n) => n.node.id === aMinerId);
      if (neighbor) latencyA = neighbor.latency;
    }

    if (
      bMinerId !== undefined &&
      this.id !== undefined &&
      bMinerId === this.id
    ) {
      latencyB = 0;
    } else if (this.id !== undefined && bMinerId !== undefined) {
      const neighbor = this.neighbors.find((n) => n.node.id === bMinerId);
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

  checkForksAndSort() {
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

  addBlock(block: Block): { success: boolean; reason?: ValidationType } {
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

    // Encontra a altura correta para inserir
    const heightIndex = this.getHeightIndex(block.height);

    // Procura o pai
    const parent = this.findBlockNode(block.previousHash);
    if (!parent) return { success: false, reason: 'invalid-parent' };

    if (
      this.heights[heightIndex]?.find(
        (n) => n.block.hash === blockNode.block.hash
      )
    ) {
      return { success: false, reason: 'duplicate' };
    }

    blockNode.parent = parent;

    // Adiciona como filho
    if (!parent.children.find((n) => n.block.hash === blockNode.block.hash)) {
      parent.children.push(blockNode);
    }

    // Se a altura não existe, cria um novo array
    if (heightIndex < 0) {
      this.heights.unshift([blockNode]);
    } else if (!this.heights[heightIndex]) {
      this.heights[heightIndex] = [blockNode];
    } else {
      this.heights[heightIndex].push(blockNode);
    }

    this.checkForksAndSort();
    return { success: true };
  }

  // Encontra um bloco na estrutura heights pelo hash
  private findBlockNode(hash: string) {
    for (const height of this.heights) {
      const blockNode = height.find((node) => node.block.hash === hash);
      if (blockNode) return blockNode;
    }
    return undefined;
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

  // Retorna os últimos 5 blocos da main chain (excluindo o origin fake block)
  updateLastMainBlocks() {
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
  updateActiveForkHeights() {
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
  getDifficultyAdjustmentInterval(height: number): number {
    const epoch = this.consensus.epochs.find(
      (e) => height >= e.startHeight && (!e.endHeight || height < e.endHeight)
    );
    if (!epoch) {
      throw new Error(`No consensus parameters found for height ${height}`);
    }
    return epoch.parameters.difficultyAdjustmentInterval;
  }

  getCurrentEpoch(): ConsensusEpoch {
    return this.consensus.epochs[this.consensus.epochs.length - 1];
  }

  getEpochForHeight(height: number): ConsensusEpoch {
    const epoch = this.consensus.epochs.find(
      (e) => height >= e.startHeight && (!e.endHeight || height < e.endHeight)
    );
    if (!epoch) {
      throw new Error(`No consensus parameters found for height ${height}`);
    }
    return epoch;
  }

  // Get consensus parameters for a specific block height
  getConsensusForHeight(height: number): ConsensusParameters {
    const epoch = this.consensus.epochs.find(
      (e) => height >= e.startHeight && (!e.endHeight || height < e.endHeight)
    );
    if (!epoch) {
      throw new Error(`No consensus parameters found for height ${height}`);
    }
    return epoch.parameters;
  }

  getCurrentConsensusParameters(): ConsensusParameters {
    return this.getConsensusForHeight(this.currentBlock?.height || 0);
  }

  // Método para validar um bloco individual
  validateBlock(block: Block, height: number, previousBlock?: Block): boolean {
    if (height === -1) {
      return true;
    }

    // 1. Verifica se o hash do bloco é válido
    if (block.hash !== block.calculateHash()) {
      this.addEvent({
        type: 'block-rejected',
        blockHash: block.hash,
        timestamp: Date.now(),
        reason: 'invalid-hash',
      });
      return false;
    }

    // 2. Verifica se o hash atinge o target
    if (!block.isValid()) {
      this.addEvent({
        type: 'block-rejected',
        blockHash: block.hash,
        timestamp: Date.now(),
        reason: 'invalid-target',
      });
      return false;
    }

    // 3. Verifica se o bloco anterior existe e tem o hash correto
    if (height > 0) {
      if (!previousBlock || previousBlock.hash !== block.previousHash) {
        this.addEvent({
          type: 'block-rejected',
          blockHash: block.hash,
          timestamp: Date.now(),
          reason: 'invalid-parent',
        });
        return false;
      }
    }

    // 4. Verifica se o timestamp é razoável
    const now = Date.now();
    if (block.timestamp > now + 7200000) {
      this.addEvent({
        type: 'block-rejected',
        blockHash: block.hash,
        timestamp: Date.now(),
        reason: 'invalid-timestamp',
      });
      return false;
    }

    // 5. Verifica se o timestamp é posterior ao bloco anterior
    if (previousBlock && block.timestamp <= previousBlock.timestamp) {
      this.addEvent({
        type: 'block-rejected',
        blockHash: block.hash,
        timestamp: Date.now(),
        reason: 'invalid-timestamp',
      });
      return false;
    }

    // 6. Verifica se a dificuldade (nBits) está correta
    if (height > 0) {
      const expectedNBits = this.calculateExpectedNBits(height);
      if (block.nBits !== expectedNBits) {
        this.addEvent({
          type: 'block-rejected',
          blockHash: block.hash,
          timestamp: Date.now(),
          reason: 'invalid-nbits',
        });
        return false;
      }
    }

    // 7. Verifica se o subsídio está correto
    const expectedSubsidy = this.calculateBlockSubsidy(height);
    const actualSubsidy = block.transactions[0].outputs[0].value;
    if (actualSubsidy !== expectedSubsidy) {
      this.addEvent({
        type: 'block-rejected',
        blockHash: block.hash,
        timestamp: Date.now(),
        reason: 'invalid-subsidy',
      });
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

  // Subscribe to a peer's block broadcasts
  subscribeToPeerBlocks(peer: Node) {
    if (this.peerBlockSubscriptions[peer.id!]) return;
    const neighbor = this.neighbors.find((n) => n.node.id === peer.id);
    const latency = neighbor?.latency || 0;
    this.peerBlockSubscriptions[peer.id!] = peer.blockBroadcast$
      .pipe(delay(latency))
      .subscribe((block: Block) => {
        this.onPeerBlockReceived(block, peer);
      });

    // Faz um sync inicial com o peer
    const myHeight = this.getLatestBlock()?.height || -1;
    const peerLatestBlock = peer.getLatestBlock();
    if (peerLatestBlock && peerLatestBlock.height > myHeight) {
      this.catchUpBlocks(myHeight + 1, peerLatestBlock.height, peer);
    }
  }

  // Unsubscribe from a peer's block broadcasts
  unsubscribeFromPeerBlocks(peer: Node) {
    this.peerBlockSubscriptions[peer.id!]?.unsubscribe();
    delete this.peerBlockSubscriptions[peer.id!];
  }

  // Método centralizado para processar um bloco recebido
  private processBlock(block: Block, isOrphan: boolean = false): void {
    const result = this.addBlock(block);
    if (result.success) {
      this.addEvent({
        type: 'block-validated',
        blockHash: block.hash,
        timestamp: Date.now(),
      });
      this.updateLastMainBlocks();
      this.updateActiveForkHeights();

      // Tentar encaixar órfãos que dependem deste bloco
      this.tryAttachOrphans(block.hash);

      // Atualizar current block apenas se não for um órfão
      this.initBlockTemplate(block);
    } else if (result.reason === 'invalid-parent') {
      // Se não conseguiu adicionar por falta do bloco anterior, armazena como órfão
      if (!this.orphanBlocks.has(block.previousHash)) {
        this.orphanBlocks.set(block.previousHash, []);
      }
      this.orphanBlocks.get(block.previousHash)!.push(block);

      // Log apenas se não for um órfão (para evitar duplicação de logs)
      if (!isOrphan) {
        this.addEvent({
          type: 'block-rejected',
          blockHash: block.hash,
          timestamp: Date.now(),
          reason: 'invalid-parent',
        });
      }
    } else {
      this.addEvent({
        type: 'block-rejected',
        blockHash: block.hash,
        timestamp: Date.now(),
        reason: result.reason,
      });
    }
  }

  // Handler for when a block is received from a peer
  onPeerBlockReceived(block: Block, peer: Node) {
    // Deduplicação: se já recebeu esse bloco, não processa novamente
    if (this.receivedBlockHashes.has(block.hash)) return;
    this.receivedBlockHashes.add(block.hash);

    // 1. Marcar como sincronizando
    this.isSyncing = true;

    // 2. Log de recebimento do bloco
    this.addEvent({
      type: 'block-received',
      from: peer.id,
      blockHash: block.hash,
      timestamp: Date.now(),
    });

    // 3. Processar o bloco
    this.processBlock(block);

    // 4. Catch-up: se o bloco recebido está à frente do topo local, busque blocos faltantes
    const myHeight = this.getLatestBlock()?.height || -1;
    if (block.height > myHeight + 1) {
      this.catchUpBlocks(myHeight + 1, block.height, peer);
    }

    // 5. Repropagar para outros peers
    this.blockBroadcast$.next(block);

    this.isSyncing = false;
  }

  // Tenta encaixar órfãos que dependem de um bloco recém-adicionado
  private tryAttachOrphans(parentHash: string) {
    const orphans = this.orphanBlocks.get(parentHash);
    if (!orphans) return;
    this.orphanBlocks.delete(parentHash);

    for (const orphan of orphans) {
      this.processBlock(orphan, true);
    }
  }

  // Busca ativa de blocos faltantes dos peers
  private async catchUpBlocks(
    startHeight: number,
    endHeight: number,
    originPeer: Node
  ) {
    const BATCH_SIZE = 10; // Número de blocos por lote
    const totalBlocks = endHeight - startHeight + 1;
    let processedBlocks = 0;
    const startTime = Date.now();

    // Log inicial de início de sincronização
    this.addEvent({
      type: 'sync-progress',
      from: originPeer.id,
      blockHash: `sync-progress-start`,
      timestamp: Date.now(),
      reason: 'sync-progress',
      syncProgress: {
        processed: 0,
        total: totalBlocks,
        blocksPerSecond: 0,
        estimatedTimeRemaining: 0,
      },
    });

    for (let h = startHeight; h <= endHeight; h += BATCH_SIZE) {
      const batchEnd = Math.min(h + BATCH_SIZE - 1, endHeight);
      const blocks = await this.requestBlockFromPeers(h, batchEnd, originPeer);

      if (!blocks.length) break;

      processedBlocks += blocks.length;
      const elapsedTime = (Date.now() - startTime) / 1000; // em segundos
      const blocksPerSecond = processedBlocks / (elapsedTime || 1);
      const remainingBlocks = totalBlocks - processedBlocks;
      const estimatedTimeRemaining =
        blocksPerSecond > 0 ? remainingBlocks / blocksPerSecond : 0;

      // Atualiza o log com o progresso
      this.addEvent({
        type: 'sync-progress',
        from: originPeer.id,
        blockHash: `sync-progress-${h}-${batchEnd}`,
        timestamp: Date.now(),
        reason: 'sync-progress',
        syncProgress: {
          processed: processedBlocks,
          total: totalBlocks,
          blocksPerSecond,
          estimatedTimeRemaining,
        },
      });
    }
  }

  // Solicita todos os blocos ativos de todos os peers conectados
  private async requestBlockFromPeers(
    startHeight: number,
    endHeight: number,
    originPeer: Node
  ): Promise<Block[]> {
    const foundBlocks: Block[] = [];
    const neighbor = this.neighbors.find((n) => n.node.id === originPeer.id);
    const latency = neighbor?.latency || 0;

    // Simula latência na requisição (uma única vez por lote)
    await new Promise((resolve) => setTimeout(resolve, latency));

    if (originPeer) {
      // Busca todos os blocos do lote de uma vez
      for (let h = startHeight; h <= endHeight; h++) {
        const blocks = originPeer.getActiveBlocksByHeight?.(h) || [];
        for (const block of blocks) {
          this.onPeerBlockReceived(block, originPeer);
          foundBlocks.push(block);
        }
      }
    }
    return foundBlocks;
  }

  // Helper para obter o Node conectado pelo id
  private getConnectedPeerNode(peerId: number): Node | null {
    const neighbor = this.neighbors.find((n) => n.node.id === peerId);
    return neighbor?.node || null;
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
  getActiveBlocksByHeight(height: number): Block[] {
    const blocks: Block[] = [];
    for (const heightArr of this.heights) {
      for (const node of heightArr) {
        if (node.block.height === height && node.isActive) {
          blocks.push(node.block);
        }
      }
    }
    return blocks;
  }
}
