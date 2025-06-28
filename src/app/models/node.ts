import * as EC from 'elliptic';
import { BehaviorSubject, pipe, Subject, Subscription } from 'rxjs';
import { delay, filter, tap } from 'rxjs/operators';
import {
  Block,
  BlockNode,
  generateTransactionId,
  ScriptPubKey,
  Transaction,
} from './block.model';
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

import { areConsensusVersionsCompatible } from './consensus.model';
import { Height } from './height.model';
import { BipType, BitcoinAddressData, Wallet } from './wallet.model';

import { getAddressType } from '../utils/tools';

const ec = new EC.ec('secp256k1');

export interface Neighbor {
  latency: number;
  node: Node;
  connectedAt: number;
}

export type Balances = {
  [address: string]: BitcoinAddressData | undefined;
};

export class Node {
  private readonly INITIAL_NBITS = 0x1e9fffff;
  private readonly SUBSIDY = 50 * 100000000; // 50 BTC em satoshis
  private readonly MAX_PEERS: number = Math.floor(Math.random() * 2) + 2; // Random entre 2 e 3

  peerSearchInterval: number = 60000; // 1 minute
  lastPeerSearch: number = 0;
  isSearchingPeers: boolean = false;

  isSyncing: boolean = false;
  isAddingBlock: boolean = false;

  // Log de eventos de propagação/validação de blocos
  events: NodeEvent[] = [];

  id: number = 0;
  peers: Neighbor[] = [];

  // Campos para minerador
  nodeType: 'miner' | 'peer' | 'user' = 'miner';
  name: string = '';
  hashRate: number | null = null;
  currentHashRate: number = 0; // Hash rate real sendo alcançado
  private hashCount: number = 0;
  private lastHashRateUpdate: number = 0;
  currentBlock?: Block;
  isMining: boolean = false;
  miningAddress: BitcoinAddressData = {
    keys: {
      pub: {
        hex: '',
        decimal: '',
      },
      priv: {
        hex: '',
        decimal: '',
        wif: '',
      },
    },
    address: '',
    balance: 0,
    utxos: [],
    bipFormat: 'bip84',
    transactions: [],
  }; // Endereço para receber recompensas de mineração

  // Cronômetro de mineração
  miningLastHashTime: number | null = null;
  miningLastTickTime: number | null = null;
  miningElapsed: number = 0;

  // Blockchain local do nó
  genesis?: BlockNode;

  // Estrutura para organizar blocos por altura
  heights: Height[] = [];

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
  private peerTransactionSubscriptions: { [peerId: number]: Subscription } = {};
  private orphanBlocks: Map<string, Block[]> = new Map(); // chave: previousHash, valor: blocos órfãos que dependem desse hash

  private blockBroadcastPipe = (peer: Node, latency: number) =>
    pipe(
      filter((block: Block) => this.onPeerBlockFiltering(block, peer)),
      delay(latency),
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

  private readonly CONNECTION_TTL = 5 * 60 * 1000; // 5 minutos em ms

  private pendingConsensusEvents: { height: number; event: NodeEvent }[] = [];

  // Estrutura para rastrear UTXOs e saldos (Unspent Transaction Outputs)
  private _balances: Balances = {};
  public balances$: BehaviorSubject<Balances> = new BehaviorSubject<Balances>(
    this._balances
  );

  // UTXOs virtuais do bloco atual (para chained transactions)
  private virtualUtxos: Map<
    string,
    { output: { value: number; scriptPubKey: ScriptPubKey } }
  > = new Map();

  get balances(): Balances {
    return this._balances;
  }
  set balances(val: Balances) {
    this._balances = val;
    this.balances$.next(val);
    this.updateWalletFromBalances();
  }

  wallet: Wallet = {
    step: 'choose',
    seed: [],
    seedPassphrase: '',
    passphrase: '',
    addresses: [],
  };

  pendingTransactions: Transaction[] = [];

  public transactionBroadcast$ = new Subject<{
    tx: Transaction;
    fromPeerId?: number;
  }>();

  isMalicious: boolean = false;

  constructor(init?: Partial<Node>) {
    Object.assign(this, init);
  }

  addBlock(block: Block): NodeEventLogReasons | undefined {
    // Primeiro valida e processa as transações
    const validationResult = this.validateAndProcessTransactions(block);
    if (!validationResult.valid) {
      // Retorna apenas o tipo correto, a informação específica será adicionada nos logs
      return 'transaction-rejected';
    }

    // Continua com o processamento normal do bloco
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
      this.heights.unshift({
        n: -1,
        blocks: [originNode],
        events: [],
      });
      this.genesis = originNode;
    }

    // Busca otimizada do pai: só procura em height - 1
    const parentNode = this.findParentNode(block);
    if (!parentNode) return 'invalid-parent';

    // Encontra a altura correta para inserir
    const heightIndex = this.getHeightIndex(block.height);
    const height = this.heights[heightIndex];

    // Verifica se o bloco já existe na altura
    if (height?.blocks.find((n) => n.block.hash === blockNode.block.hash)) {
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
      this.heights = [
        {
          n: block.height,
          blocks: [blockNode],
          events: [],
        },
        ...this.heights,
      ];
      // Verifica eventos pendentes para esse height
      this.addPendingEventsToHeight(block.height);
    } else if (!this.heights[heightIndex]) {
      this.heights[heightIndex] = {
        n: block.height,
        blocks: [blockNode],
        events: [],
      };
      this.addPendingEventsToHeight(block.height);
    } else {
      this.heights[heightIndex].blocks.push(blockNode);
    }

    const finalHeightIndex = this.getHeightIndex(block.height);
    this.checkForksAndSortFrom(finalHeightIndex);
    this.updateMiniBlockchain();

    // Processa a coinbase APÓS todas as validações
    this.processCoinbase(block);

    return undefined;
  }

  initBlockTemplate(lastBlock?: Block): Block {
    // Limpa UTXOs virtuais do bloco anterior
    this.clearVirtualUtxos();

    const timestamp = Date.now();
    const previousHash =
      lastBlock?.hash ||
      '0000000000000000000000000000000000000000000000000000000000000000';
    // Calcula o nBits correto para o novo bloco
    const { next } = this.getDifficulty(lastBlock);
    const nBits = next?.nBits || lastBlock?.nBits || this.INITIAL_NBITS;
    const blockHeight = lastBlock ? lastBlock.height + 1 : 0;
    const subsidy = this.calculateBlockSubsidy(blockHeight);
    // Cria a transação coinbase
    const coinbaseOutputs = [
      {
        value: subsidy,
        scriptPubKey: {
          address: this.miningAddress.address,
          pubKey: this.miningAddress.keys.pub.hex,
        },
        blockHeight,
      },
    ];
    const coinbaseTx: Transaction = {
      id: generateTransactionId([], coinbaseOutputs, timestamp),
      inputs: [], // Coinbase não tem inputs
      outputs: coinbaseOutputs,
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

  // Processa um tick de mineração
  processMiningTick(now: number, batchSize: number) {
    if (!this.isMining || !this.currentBlock) return;

    const block = this.currentBlock;
    const hashRate = this.hashRate;

    // Atualiza o tempo decorrido
    if (!this.miningLastTickTime) {
      this.miningLastTickTime = now;
    }

    const tickTime = now - this.miningLastTickTime;
    this.miningElapsed = block.miningElapsed += tickTime;
    this.miningLastTickTime = now;

    if (hashRate === null) {
      // Modo máximo - processa o batch size adaptativo
      for (let i = 0; i < batchSize + 1; i++) {
        block.nonce++;
        block.hash = block.calculateHash();
        this.incrementHashCount();

        if (block.isHashBelowTarget()) {
          this.handleMinedBlock(block);
          break;
        }
      }
    } else {
      if (this.miningLastHashTime === null) {
        this.miningLastHashTime = 0;
      }

      this.miningLastHashTime += tickTime;

      // Modo com hash rate controlado
      const timeNeededForOneHash = 1000 / hashRate; // tempo em ms para 1 hash
      const hashesToProcess =
        this.miningLastHashTime >= timeNeededForOneHash
          ? Math.floor(this.miningLastHashTime / timeNeededForOneHash)
          : 0;

      // Se houver hashes para processar, atualiza o tempo restante
      if (hashesToProcess > 0) {
        this.miningLastHashTime -= timeNeededForOneHash * hashesToProcess;
      }

      for (let i = 0; i < hashesToProcess; i++) {
        block.nonce++;
        block.hash = block.calculateHash();
        this.incrementHashCount();

        if (block.isHashBelowTarget()) {
          this.handleMinedBlock(block);
          break;
        }
      }
    }
  }

  private handleMinedBlock(block: Block) {
    block.minerId = this.id;

    const addResult = this.addBlock(block);

    // Se o bloco não foi adicionado (foi rejeitado), não continue o fluxo!
    if (addResult) {
      // Log de rejeição local
      const event = this.addEvent('block-rejected', {
        block,
        reason: addResult,
      });

      // Se foi rejeitado por transação, adiciona informação específica
      if (addResult === 'transaction-rejected') {
        // Revalida para obter a informação específica
        const validationResult = this.validateAndProcessTransactions(block);
        if (!validationResult.valid) {
          EventManager.log(event, 'transaction-rejected', {
            reason: validationResult.reason,
            txId: validationResult.txId?.slice(0, 8) + '...',
            blockHeight: block.height,
          });
        }
      }

      EventManager.fail(event);
      // Cria um novo bloco para continuar minerando normalmente
      this.initBlockTemplate(block);
      return;
    }

    // Log de bloco minerado localmente
    const event = this.addEvent('block-mined', { block });

    this.checkDifficultyAdjustment(block, event);
    this.checkHalving(block, event);

    EventManager.complete(event);

    // Limpa UTXOs virtuais do bloco minerado
    this.clearVirtualUtxos();

    // Cria um novo bloco para continuar minerando
    this.initBlockTemplate(block);

    // Emite evento para propagar o bloco
    this.blockBroadcast$.next(block);
  }

  /**
   * Calcula a dificuldade atual e a próxima para um bloco de referência.
   * @param referenceBlock Bloco de referência para o cálculo
   * @returns Objeto contendo a dificuldade atual e a próxima (se houver ajuste)
   */
  private getDifficulty(referenceBlock?: Block): {
    current: { nBits: number };
    next?: { nBits: number; adjustmentFactor: number };
  } {
    // Se não houver bloco de referência, assume que é o primeiro bloco
    if (!referenceBlock) {
      return {
        current: {
          nBits: this.INITIAL_NBITS,
        },
      };
    }

    const epoch = this.consensus.getConsensusForHeight(referenceBlock.height);
    const interval = epoch.parameters.difficultyAdjustmentInterval;
    const targetBlockTime = epoch.parameters.targetBlockTime;
    const adjustedHeight = referenceBlock.height - epoch.startHeight + 1;

    // Se não for um bloco de ajuste, retorna apenas a dificuldade atual
    if (adjustedHeight % interval !== 0) {
      return {
        current: {
          nBits: referenceBlock.nBits,
        },
      };
    }

    // Encontra o bloco do último ajuste
    const prevAdjustmentHeight = adjustedHeight - interval;
    const prevIndex = this.getHeightIndex(prevAdjustmentHeight);
    let prevAdjustmentBlock: Block | undefined = undefined;

    if (prevIndex >= 0 && this.heights[prevIndex]) {
      // Procura entre os blocos da altura o ancestral correto
      for (const candidate of this.heights[prevIndex].blocks) {
        let current: Block | undefined = referenceBlock;
        while (current && current.height > prevAdjustmentHeight) {
          current = this.findParentNode(current)?.block;
        }
        if (current && current.hash === candidate.block.hash) {
          prevAdjustmentBlock = candidate.block;
          break;
        }
      }
    }

    if (!prevAdjustmentBlock) {
      return {
        current: {
          nBits: referenceBlock.nBits,
        },
      };
    }

    const actualTime = referenceBlock.timestamp - prevAdjustmentBlock.timestamp;
    const expectedTime = interval * targetBlockTime * 1000;
    let adjustmentFactor = actualTime / expectedTime;

    // Limita o fator de ajuste para evitar mudanças bruscas
    adjustmentFactor = Math.max(0.25, Math.min(adjustmentFactor, 4));

    // Calcula o novo target
    const prevTarget = Number(prevAdjustmentBlock.target);
    const newTarget = Math.round(prevTarget * adjustmentFactor);
    const newNBits = this.targetToNBits(newTarget);

    return {
      current: {
        nBits: referenceBlock.nBits,
      },
      next: {
        nBits: newNBits,
        adjustmentFactor,
      },
    };
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
    const halvings = Math.floor(
      blockHeight / this.consensus.parameters.halvingInterval
    );
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

  /**
   * Otimizado: Atualiza forks e eventos apenas a partir da altura afetada, propagando para cima até não haver mais mudanças.
   * Use este método ao invés de percorrer todo o array de heights.
   * Se não for passado um índice, começa do bloco mais baixo (default antigo).
   */
  private checkForksAndSortFrom(heightIndexStart: number = 1) {
    let changed = true;
    let heightIndex = heightIndexStart;

    while (changed && heightIndex < this.heights.length) {
      if (heightIndex <= 0) {
        heightIndex++;
        continue;
      }

      changed = false;
      const height = this.heights[heightIndex];

      // Primeiro, identifica quais blocos mudaram de estado
      const stateChanges = new Map<Block, boolean>();
      height.blocks.forEach((block) => {
        const wasActive = block.isActive;
        const isActive = !(
          block.children.length === 0 ||
          block.children.every((c) => !c.isActive)
        );

        if (wasActive !== isActive) {
          stateChanges.set(block.block, isActive);
          block.isActive = isActive;
          changed = true;
        }
      });

      // Se houve mudanças, atualiza o UTXO set
      if (changed) {
        // Reordena os blocos
        height.blocks = height.blocks.sort(this.sortBlocks.bind(this));
        height.blocks.forEach((block) => {
          block.parent?.children.sort(this.sortBlocks.bind(this));
        });

        // Atualiza o UTXO set para cada bloco que mudou de estado
        // Processa na ordem correta: primeiro reverte os blocos que se tornaram inativos
        // (do mais recente para o mais antigo), depois aplica os que se tornaram ativos
        // (do mais antigo para o mais recente)
        const blocksToRevert = Array.from(stateChanges.entries())
          .filter(([_, isActive]) => !isActive)
          .map(([block]) => block)
          .sort((a, b) => b.height - a.height);

        const blocksToApply = Array.from(stateChanges.entries())
          .filter(([_, isActive]) => isActive)
          .map(([block]) => block)
          .sort((a, b) => a.height - b.height);

        // Reverte os blocos que se tornaram inativos
        for (const block of blocksToRevert) {
          this.updateUtxoSetForReorg(block, false);
        }

        // Aplica os blocos que se tornaram ativos
        for (const block of blocksToApply) {
          this.updateUtxoSetForReorg(block, true);
        }

        this.updateHeightEvents(heightIndex);
      }

      heightIndex++;
    }
  }

  // Método centralizado para calcular o índice na estrutura heights (ordem inversa)
  getHeightIndex(height: number): number {
    const lastIndex = this.heights.length - 1;
    if (this.heights.length > 0 && this.heights[lastIndex].n === -1) {
      return this.heights.length - height - 2;
    }
    return this.heights.length - height - 1;
  }

  private findParentNode(block: Block): BlockNode | undefined {
    const heightIndex = this.getHeightIndex(block.height - 1);
    const parent = this.heights[heightIndex]?.blocks.find(
      (h) => h.block.hash === block.previousHash
    );
    return parent;
  }

  // Retorna o bloco mais recente usando a estrutura heights
  getLatestBlock(): Block | undefined {
    if (!this.heights.length) return undefined;

    // Percorre as alturas da mais alta para a mais baixa
    for (const height of this.heights) {
      if (height.blocks.length > 0 && height.n !== -1) {
        // Retorna o primeiro bloco da altura mais alta, ignorando o origin block
        return height.blocks[0].block;
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
    const heights: Height[] = [];
    let blocks: BlockNode[] = [this.genesis];
    while (blocks.length > 0) {
      heights.unshift({
        n: blocks[0].block.height,
        blocks: blocks,
        events: [],
      });
      blocks.forEach((block) => {
        block.children = block.children.filter((child) => child.isActive);
      });
      // Avança para o próximo bloco na main chain (primeiro filho)
      blocks = blocks.flatMap((block) => block.children);
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
        .flatMap((h) => h.blocks)
        .find((n) => n.block.hash === prevHash);
      current = prevNode?.block;
      count++;
    }
    this.lastMainBlocks = blocks;
  }

  // Retorna as alturas dos forks ativos entre os últimos 5 blocos
  private updateActiveForkHeights() {
    const forkHeights: number[] = [];
    for (const height of this.heights) {
      const activeBlocks = height.blocks.filter((n) => n.isActive);
      if (activeBlocks.length > 1) {
        if (height.n >= 0) forkHeights.push(height.n);
      }
    }
    this.activeForkHeights = forkHeights;
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
          .pipe(this.blockBroadcastPipe(peer, latency))
          .subscribe();
      }

      // Subscription de transação: só se ainda não existe
      if (!this.peerTransactionSubscriptions[peer.id!]) {
        this.peerTransactionSubscriptions[peer.id!] = peer.transactionBroadcast$
          .pipe(delay(latency))
          .subscribe(({ tx, fromPeerId }) => {
            if (fromPeerId !== this.id) {
              this.onPeerTransactionReceived(tx, peer);
            }
          });
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
          .pipe(peer.blockBroadcastPipe(this, latency))
          .subscribe();
      }

      // Subscription de transação: só se ainda não existe
      if (!peer.peerTransactionSubscriptions[this.id!]) {
        peer.peerTransactionSubscriptions[this.id!] = this.transactionBroadcast$
          .pipe(delay(latency))
          .subscribe(({ tx, fromPeerId }) => {
            if (fromPeerId !== peer.id) {
              peer.onPeerTransactionReceived(tx, this);
            }
          });
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
    if (this.peerBlockSubscriptions[peer.id!]) {
      this.peerBlockSubscriptions[peer.id!]?.unsubscribe();
      delete this.peerBlockSubscriptions[peer.id!];
    }

    if (this.peerTransactionSubscriptions[peer.id!]) {
      this.peerTransactionSubscriptions[peer.id!]?.unsubscribe();
      delete this.peerTransactionSubscriptions[peer.id!];
    }

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

    const latestForks = peer.heights[0]?.blocks || [];
    for (const fork of latestForks) {
      this.catchUpChain(fork.block, peer, event);
    }

    if (latestForks.length === 0) {
      EventManager.log(event, 'already-in-sync', { peerId: peer.id });
    }

    // Sincronizar transações do bloco atual
    this.syncCurrentBlockTransactions(peer, event);

    EventManager.log(event, 'sync-completed', { peerId: peer.id });
  }

  private syncCurrentBlockTransactions(peer: Node, event: NodeEvent) {
    // Se não há currentBlock, crie um automaticamente
    if (!this.currentBlock) {
      const lastBlock = this.getLatestBlock();
      this.initBlockTemplate(lastBlock);
    }

    // Garante que temos um currentBlock agora
    if (!this.currentBlock) {
      return;
    }

    // Só sincroniza se o peer tem bloco atual
    if (!peer.currentBlock) {
      return;
    }

    // Pega as transações do peer que não estão no bloco atual deste nó
    const peerTransactions = peer.currentBlock.transactions.slice(1); // Exclui coinbase
    const myTransactionIds = new Set(
      this.currentBlock.transactions.slice(1).map((tx) => tx.id)
    );

    let syncedCount = 0;
    for (const tx of peerTransactions) {
      if (!myTransactionIds.has(tx.id)) {
        // 1. Log de recebimento (mostra o template da tx)
        EventManager.log(event, 'transaction-received', {
          tx,
          peerId: peer.id,
        });
        // 2. Log de validação
        EventManager.log(event, 'validating-transaction', {
          txId: tx.id,
          peerId: peer.id,
        });

        // 2. Validação
        const { valid, reason } = this.isValidTransaction(tx);
        if (valid) {
          this.addTransaction(tx, event, false); // logTxData = false, não mostra template de novo
          syncedCount++;
        } else {
          EventManager.log(event, 'transaction-rejected', {
            reason: reason || 'Transação inválida durante sync',
            txId: tx.id,
          });
        }
      }
    }

    if (syncedCount > 0) {
      EventManager.log(event, 'transactions-synced', {
        peerId: peer.id,
        count: syncedCount,
      });
    }
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
      } else if (reason === 'transaction-rejected') {
        // Revalida para obter a informação específica
        const validationResult = this.validateAndProcessTransactions(block);
        if (!validationResult.valid) {
          EventManager.log(event, 'block-rejected', {
            reason: `${EVENT_LOG_REASONS[reason]}: ${
              validationResult.reason || ''
            }`,
            txId: validationResult.txId,
          });
        } else {
          EventManager.log(event, 'block-rejected', {
            reason: EVENT_LOG_REASONS[reason],
          });
        }
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

    this.checkDifficultyAdjustment(block, event);
    this.checkHalving(block, event);

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
    return this.heights[heightIndex]?.blocks.some(
      (h) => h.block.hash === block.hash
    );
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
    if (this.checkIfBlockExists(orphan)) {
      EventManager.log(event, 'already-in-sync', { peerId: origin.id });
      return;
    }

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

  private downloadParentBlockFromPeer(block: Block, peer: Node) {
    const heightIndex = peer.getHeightIndex(block.height - 1);
    return peer.heights[heightIndex]?.blocks.find(
      (h) => h.block.hash === block.previousHash
    )?.block;
  }

  // Busca um bloco local por altura
  getBlockByHeight(height: number, hash: string): Block | undefined {
    const heightIndex = this.getHeightIndex(height);
    return this.heights[heightIndex]?.blocks.find((h) => h.block.hash === hash)
      ?.block;
  }

  // Busca todos os blocos ativos de uma altura
  getBlocksByHeight(height: number): Block[] {
    const heightIndex = this.getHeightIndex(height);
    return this.heights[heightIndex]?.blocks.map((n) => n.block) || [];
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

    const {
      current: { nBits: expectedNBits },
    } = this.getDifficulty(block);

    if (block.nBits !== expectedNBits) {
      return 'invalid-bits';
    }

    // 4. Validar target time
    const previousBlock = this.getBlockByHeight(
      block.height - 1,
      block.previousHash
    );
    if (previousBlock) {
      // Regra Bitcoin: timestamp deve ser maior que a mediana dos últimos 11 blocos
      const medianTimePast = this.getMedianTimePast(block.height, block.hash);
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
  private getMedianTimePast(
    height: number,
    hash: string,
    window: number = 11
  ): number {
    const timestamps: number[] = [];
    let currentHeight = height - 1;
    while (currentHeight >= 0 && timestamps.length < window) {
      const block = this.getBlockByHeight(currentHeight, hash);
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
        const latency = 50 + Math.floor(Math.random() * 451); // 50-500ms (mais realista)
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
      const timeSinceConnection = Date.now() - p.connectedAt;
      const timeUntilTimeout = this.CONNECTION_TTL - timeSinceConnection;

      if (timeSinceConnection > this.CONNECTION_TTL) {
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

  addEvent(type: NodeEventType, data?: any, logs: NodeEventLog[] = []) {
    const event: NodeEvent = {
      minerId: this.id,
      type,
      data,
      timestamp: Date.now(),
      logs,
      state: 'pending',
    };
    this.events.unshift(event);

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

  private removeIncompatibleBlocksOnConsensusChange(
    newConsensus: ConsensusVersion,
    event: NodeEvent
  ) {
    const oldConsensus = this.consensus;

    // Atualiza o consenso
    this.consensus = newConsensus;

    // Obtém a altura atual
    const currentHeight = this.getLatestBlock()?.height || 0;

    const compatible = areConsensusVersionsCompatible(
      oldConsensus,
      newConsensus,
      currentHeight
    );

    // Se as versões são compatíveis (soft fork), apenas atualiza o consenso
    if (compatible) {
      return;
    }

    // Se chegou aqui, as versões são incompatíveis (hard fork)

    EventManager.log(event, 'removing-incompatible-blocks', {
      newConsensus,
      oldConsensus,
    });

    // Encontra o ponto de divergência (altura onde o consenso mudou)
    let highestVersion =
      newConsensus.version > oldConsensus.version ? newConsensus : oldConsensus;
    const lowestVersion =
      newConsensus.version > oldConsensus.version ? oldConsensus : newConsensus;

    // algoritmo para procurar a altura de mudança de consenso entre as duas versões
    while (highestVersion.previousVersion?.hash !== lowestVersion.hash) {
      if (highestVersion.previousVersion) {
        highestVersion = highestVersion.previousVersion;
      } else {
        throw new Error('Incompatible consensus versions');
      }
    }

    const changeStartHeight = highestVersion.startHeight;

    // Remove todos os blocos após o ponto de divergência (não necessariamente é a altura de mudança de consenso)
    // Procurar pelo último bloco compatível com o consenso antigo
    const changeStartIndex = this.getHeightIndex(changeStartHeight);
    let lastCompatibleIndex = undefined;

    for (let i = changeStartIndex; i >= 0; i--) {
      for (let j = 0; j < this.heights[i].blocks.length; j++) {
        const block = this.heights[i].blocks[j].block;
        const reason = this.validateBlockConsensus(block);
        if (reason) {
          delete this.heights[i].blocks[j];
        } else {
          lastCompatibleIndex = i;
        }
      }
    }

    lastCompatibleIndex ??= changeStartIndex;
    this.heights = this.heights.slice(lastCompatibleIndex);
    this.heights[0].blocks.forEach((h) => (h.children = []));

    EventManager.log(event, 'removing-incompatible-blocks-completed', {
      newConsensus,
      oldConsensus,
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

    // Adiciona evento no height correspondente à mudança de consenso
    const heightIndex = this.getHeightIndex(newConsensus.startHeight);
    if (heightIndex >= 0 && this.heights[heightIndex]) {
      this.heights[heightIndex].events.push(event);
    } else {
      // Salva para adicionar depois
      this.pendingConsensusEvents.push({
        height: newConsensus.startHeight - 1,
        event,
      });
    }

    this.removeIncompatibleBlocksOnConsensusChange(newConsensus, event);
    EventManager.complete(event);
  }

  /**
   * Cria e adiciona o evento de ajuste de dificuldade ao BlockNode, se aplicável.
   */
  checkDifficultyAdjustment(block: Block, event?: NodeEvent) {
    if (block.height === 0) {
      return;
    }

    const heightIndex = this.getHeightIndex(block.height);
    const blockNode = this.heights[heightIndex].blocks.find(
      (b) => b.block.hash === block.hash
    );

    if (!blockNode || !blockNode.isActive) {
      return;
    }

    const difficulty = this.getDifficulty(block);

    if (difficulty.next) {
      const eventData = {
        oldDifficulty: difficulty.current.nBits,
        newDifficulty: difficulty.next.nBits,
        adjustmentFactor: difficulty.next.adjustmentFactor.toFixed(2),
        height: block.height,
      };
      const adjustEvent = event
        ? EventManager.log(event, 'difficulty-adjustment', eventData)
        : this.addEvent('difficulty-adjustment', eventData);

      blockNode.events = blockNode.events || [];
      blockNode.events.push(adjustEvent);

      // Organize height events
      this.heights[heightIndex].events = this.heights[
        heightIndex
      ].events.filter((e) => e.type !== 'difficulty-adjustment');
      this.heights[heightIndex].events.push(
        ...blockNode.events.filter((e) => e.type === 'difficulty-adjustment')
      );
    }
  }

  /**
   * Verifica se o bloco é um bloco de halving e adiciona o evento correspondente.
   */
  checkHalving(block: Block, event?: NodeEvent) {
    if (block.height === 0) {
      return;
    }

    const heightIndex = this.getHeightIndex(block.height);
    const blockNode = this.heights[heightIndex].blocks.find(
      (b) => b.block.hash === block.hash
    );

    if (!blockNode || !blockNode.isActive) {
      return;
    }

    if (
      block.height > 0 &&
      (block.height + 1) % this.consensus.parameters.halvingInterval === 0
    ) {
      const oldSubsidy = this.calculateBlockSubsidy(block.height);
      const newSubsidy = this.calculateBlockSubsidy(block.height + 1);
      const eventData = {
        oldSubsidy: oldSubsidy / 100000000, // Convertendo de satoshis para BTC
        newSubsidy: newSubsidy / 100000000,
        height: block.height,
      };
      const halvingEvent = event
        ? EventManager.log(event, 'halving', eventData)
        : this.addEvent('halving', eventData);

      blockNode.events = blockNode.events || [];
      blockNode.events.push(halvingEvent);

      // Organize height events
      this.heights[heightIndex].events = this.heights[
        heightIndex
      ].events.filter((e) => e.type !== 'halving');
      this.heights[heightIndex].events.push(
        ...blockNode.events.filter((e) => e.type === 'halving')
      );
    }
  }

  private addPendingEventsToHeight(height: number) {
    const idx = this.getHeightIndex(height);
    if (idx >= 0 && this.heights[idx]) {
      const toAdd = this.pendingConsensusEvents.filter(
        (e) => e.height === height
      );
      for (const { event } of toAdd) {
        this.heights[idx].events.push(event);
      }
      // Remove os eventos já adicionados
      this.pendingConsensusEvents = this.pendingConsensusEvents.filter(
        (e) => e.height !== height
      );
    }
  }

  /**
   * Atualiza os eventos do height para refletir apenas os eventos especiais do bloco principal,
   * preservando eventos que foram adicionados diretamente ao nível da altura.
   */
  private updateHeightEvents(heightIndex: number) {
    const height = this.heights[heightIndex];
    if (!height) return;

    const specialTypes = ['difficulty-adjustment', 'halving'];
    // Pega o primeiro bloco (main chain) na altura
    const mainBlock = height.blocks[0];
    if (!mainBlock || !mainBlock.isActive) {
      return;
    }

    // Coleta eventos especiais do bloco principal
    const specialEvents = (mainBlock.events || []).filter((e) =>
      specialTypes.includes(e.type)
    );

    if (specialEvents.length > 0) {
      // Filtra eventos não especiais já presentes na altura
      const nonSpecialEvents = height.events.filter(
        (e) => !specialTypes.includes(e.type)
      );
      // Atualiza os eventos da altura: mantém os não especiais e adiciona os especiais do bloco
      height.events = [...nonSpecialEvents, ...specialEvents];
    }
  }

  // Método para validar e processar transações
  private validateAndProcessTransactions(block: Block): {
    valid: boolean;
    reason?: string;
    txId?: string;
  } {
    // Cria uma cópia do UTXO set atual para validação
    const tempUtxoSet = { ...this.balances };

    // Processa cada transação (exceto coinbase)
    for (let i = 1; i < block.transactions.length; i++) {
      const tx = block.transactions[i];

      // Se for malicioso e o bloco foi minerado por este nó, pula apenas a validação
      const isOwnBlock = block.minerId === this.id;
      const shouldSkipValidation = this.isMalicious && isOwnBlock;

      // Validação completa da transação (pula se for malicioso local)
      if (!shouldSkipValidation) {
        const { valid, reason } = this.isValidTransactionForBlock(
          tx,
          block,
          tempUtxoSet
        );
        if (!valid) {
          return {
            valid: false,
            reason: reason || 'Transação inválida',
            txId: tx.id,
          };
        }
      }

      let inputSum = 0;
      let outputSum = 0;

      // Processa inputs
      for (let inputIndex = 0; inputIndex < tx.inputs.length; inputIndex++) {
        const input = tx.inputs[inputIndex];
        const addressData = tempUtxoSet[input.scriptPubKey.address];
        if (!addressData) {
          return { valid: false, reason: 'UTXO não encontrado', txId: tx.id };
        }

        const utxo = addressData.utxos.find(
          (u) => u.txId === input.txid && u.outputIndex === input.vout
        );

        if (!utxo) {
          return { valid: false, reason: 'UTXO não encontrado', txId: tx.id };
        }

        inputSum += utxo.output.value;

        // Adiciona transação ao histórico do endereço (input)
        if (!addressData.transactions) addressData.transactions = [];
        if (!addressData.transactions.some((t) => t.tx.id === tx.id)) {
          addressData.transactions.push({
            tx,
            timestamp: block.timestamp,
            blockHeight: block.height,
            status: 'Confirmada',
            transactionIndex: i, // Índice da transação no bloco (1+ para transações normais)
          });
        }

        // Remove o UTXO gasto
        const newUtxos = addressData.utxos.filter(
          (u) => !(u.txId === input.txid && u.outputIndex === input.vout)
        );

        tempUtxoSet[input.scriptPubKey.address] = {
          ...addressData,
          balance: addressData.balance - utxo.output.value,
          utxos: newUtxos,
        };
      }

      // Processa outputs
      for (
        let outputIndex = 0;
        outputIndex < tx.outputs.length;
        outputIndex++
      ) {
        const output = tx.outputs[outputIndex];
        outputSum += output.value;

        // Adiciona novo UTXO
        const isMinerCoinbase =
          output.scriptPubKey.address === this.miningAddress.address;
        const addressData = tempUtxoSet[output.scriptPubKey.address] || {
          address: output.scriptPubKey.address,
          balance: 0,
          utxos: [],
          nodeId: undefined,
          ...(isMinerCoinbase
            ? { keys: this.wallet.addresses[0].bip84.keys }
            : {
                keys: {
                  pub: { hex: '', decimal: '' },
                  priv: { hex: '', decimal: '', wif: '' },
                },
              }),
          bipFormat: getAddressType(output.scriptPubKey.address),
          transactions: [],
        };

        // Adiciona transação ao histórico do endereço (output)
        if (!addressData.transactions) addressData.transactions = [];
        if (!addressData.transactions.some((t) => t.tx.id === tx.id)) {
          addressData.transactions.push({
            tx,
            timestamp: block.timestamp,
            blockHeight: block.height,
            status: 'Confirmada',
            transactionIndex: i, // Índice da transação no bloco (1+ para transações normais)
          });
        }

        addressData.utxos.push({
          output,
          blockHeight: block.height,
          txId: tx.id,
          outputIndex: outputIndex,
        });

        tempUtxoSet[output.scriptPubKey.address] = {
          ...addressData,
          balance: addressData.balance + output.value,
        };
      }

      // Valida que inputs >= outputs (pula se for malicioso local)
      if (!shouldSkipValidation && inputSum < outputSum) {
        return { valid: false, reason: 'Fundos insuficientes', txId: tx.id };
      }
    }

    // Se chegou aqui, todas as transações são válidas
    // Atualiza o UTXO set real forçando uma nova referência para reatividade
    this.balances = { ...tempUtxoSet };
    return { valid: true };
  }

  // Método específico para validar transações em blocos (não verifica duplicidade no bloco atual)
  isValidTransactionForBlock(
    tx: Transaction,
    blockContext?: Block,
    utxoSet?: { [address: string]: BitcoinAddressData | undefined }
  ): {
    valid: boolean;
    reason?: string;
  } {
    // 1. Validação básica de estrutura
    if (
      !tx.id ||
      !tx.inputs ||
      !tx.outputs ||
      tx.inputs.length === 0 ||
      tx.outputs.length === 0
    ) {
      return { valid: false, reason: 'Estrutura da transação inválida' };
    }

    // 2. Validação de inputs (UTXOs)
    let totalInputValue = 0;
    for (const input of tx.inputs) {
      let utxo = null;
      if (utxoSet) {
        const addressData = utxoSet[input.scriptPubKey.address];
        if (addressData) {
          utxo = addressData.utxos.find(
            (u) => u.txId === input.txid && u.outputIndex === input.vout
          );
        }
      }
      if (!utxo) {
        utxo = this.findUtxo(input.txid, input.vout);
      }
      if (!utxo) {
        return {
          valid: false,
          reason: `UTXO não encontrado (${input.txid}:${input.vout})`,
        };
      }

      // Verifica se o endereço do input corresponde ao UTXO
      if (utxo.output.scriptPubKey.address !== input.scriptPubKey.address) {
        return {
          valid: false,
          reason: 'Endereço do input não corresponde ao UTXO',
        };
      }

      // Verifica se o valor do input corresponde ao UTXO
      if (utxo.output.value !== input.value) {
        return {
          valid: false,
          reason: 'Valor do input não corresponde ao UTXO',
        };
      }

      totalInputValue += input.value;
    }

    // 3. Validação de outputs
    let totalOutputValue = 0;
    for (const output of tx.outputs) {
      if (output.value <= 0) {
        return { valid: false, reason: 'Valor de output inválido' };
      }
      totalOutputValue += output.value;
    }

    // 4. Validação de valores (inputs >= outputs)
    if (totalInputValue < totalOutputValue) {
      return {
        valid: false,
        reason: `Fundos insuficientes (${totalInputValue} < ${totalOutputValue})`,
      };
    }

    // 5. Validação de assinaturas
    for (const input of tx.inputs) {
      if (!input.scriptSig || input.scriptSig.length === 0) {
        return { valid: false, reason: 'Assinatura ausente no input' };
      }

      if (
        !this.verifySignature(
          input.scriptSig,
          input.scriptPubKey.pubKey,
          input.txid,
          input.vout
        )
      ) {
        return { valid: false, reason: 'Assinatura inválida' };
      }
    }

    // 6. Verifica se não é uma transação duplicada APENAS no ramo do bloco
    if (
      blockContext &&
      this.isTransactionDuplicateInBranch(tx.id, blockContext)
    ) {
      return { valid: false, reason: 'Transação duplicada no ramo do fork' };
    }

    return { valid: true };
  }

  // Método para processar a coinbase
  private processCoinbase(block: Block): void {
    const coinbase = block.transactions[0];
    if (!coinbase || coinbase.inputs.length > 0) return;

    const subsidy = this.calculateBlockSubsidy(block.height);
    // Calcula as fees das transações do bloco
    let totalFees = 0;
    for (let i = 1; i < block.transactions.length; i++) {
      const tx = block.transactions[i];
      const inputSum = tx.inputs.reduce(
        (sum, input) => sum + (input.value || 0),
        0
      );
      const outputSum = tx.outputs.reduce((sum, o) => sum + o.value, 0);
      const fee = Math.max(0, inputSum - outputSum);
      totalFees += fee;
    }
    const address = coinbase.outputs[0].scriptPubKey.address;

    // Atualiza o valor do output da coinbase para subsidy + fees
    coinbase.outputs[0].value = subsidy + totalFees;

    // Cria ou atualiza o endereço do minerador
    const isMinerCoinbase = address === this.miningAddress.address;
    const addressData = this.balances[address] || {
      address,
      balance: 0,
      utxos: [],
      nodeId: block.minerId,
      ...(isMinerCoinbase
        ? { keys: this.wallet.addresses[0].bip84.keys }
        : {
            keys: {
              pub: { hex: '', decimal: '' },
              priv: { hex: '', decimal: '', wif: '' },
            },
          }),
      bipFormat: getAddressType(address),
      transactions: [],
    };

    // Verifica se a coinbase já foi processada
    if (addressData.utxos.some((u) => u.txId === coinbase.id)) {
      return;
    }

    // Adiciona o UTXO da coinbase
    addressData.utxos.push({
      output: coinbase.outputs[0],
      blockHeight: block.height,
      txId: coinbase.id,
      outputIndex: 0,
    });

    // Adiciona coinbase ao histórico do endereço
    if (!addressData.transactions) addressData.transactions = [];
    if (!addressData.transactions.some((t) => t.tx.id === coinbase.id)) {
      addressData.transactions.push({
        tx: coinbase,
        timestamp: block.timestamp,
        blockHeight: block.height,
        status: 'Confirmada',
        transactionIndex: 0, // Coinbase sempre tem índice 0
      });
    }

    // Atualiza o saldo (subsidy + fees)
    addressData.balance += subsidy + totalFees;

    // Atualiza o mapa de saldos forçando uma nova referência para reatividade
    this.balances = {
      ...this.balances,
      [address]: { ...addressData },
    };
  }

  // Método para atualizar o UTXO set durante um reorg
  private updateUtxoSetForReorg(block: Block, isBecomingActive: boolean) {
    if (isBecomingActive) {
      // Bloco está se tornando ativo - aplica suas transações
      this.validateAndProcessTransactions(block);
      this.processCoinbase(block);
    } else {
      // Bloco está se tornando inativo - reverte suas transações
      this.revertBlockTransactions(block);
    }
  }

  // Método para reverter as transações de um bloco
  private revertBlockTransactions(block: Block): void {
    // Cria uma cópia do UTXO set atual para validação
    const tempUtxoSet = { ...this.balances };

    // Reverte as transações normais (não coinbase) na ordem inversa
    for (let i = block.transactions.length - 1; i > 0; i--) {
      const tx = block.transactions[i];

      // Remove os outputs da transação do UTXO set
      for (let j = 0; j < tx.outputs.length; j++) {
        const output = tx.outputs[j];
        const addressData = tempUtxoSet[output.scriptPubKey.address];
        if (addressData) {
          const newUtxos = addressData.utxos.filter(
            (u) => !(u.txId === tx.id && u.outputIndex === j)
          );

          tempUtxoSet[output.scriptPubKey.address] = {
            ...addressData,
            balance: Math.max(0, addressData.balance - output.value),
            utxos: newUtxos,
            transactions:
              addressData.transactions?.filter((t) => t.tx.id !== tx.id) || [],
          };
        }
      }

      // Restaura os inputs como UTXOs
      for (const input of tx.inputs) {
        const addressData = tempUtxoSet[input.scriptPubKey.address] || {
          address: input.scriptPubKey.address,
          balance: 0,
          utxos: [],
          keys: {
            pub: { hex: '', decimal: '' },
            priv: { hex: '', decimal: '', wif: '' },
          },
          bipFormat: getAddressType(input.scriptPubKey.address),
          transactions: [],
        };

        addressData.utxos.push({
          output: {
            value: input.value,
            scriptPubKey: input.scriptPubKey,
          },
          blockHeight: block.height,
          txId: input.txid,
          outputIndex: input.vout,
        });

        // Remove a transação do histórico do endereço
        addressData.transactions =
          addressData.transactions?.filter((t) => t.tx.id !== tx.id) || [];

        tempUtxoSet[input.scriptPubKey.address] = {
          ...addressData,
          balance: addressData.balance + input.value,
        };
      }
    }

    // Reverte a coinbase
    const coinbase = block.transactions[0];
    if (coinbase) {
      const address = coinbase.outputs[0].scriptPubKey.address;
      const addressData = tempUtxoSet[address];
      if (addressData) {
        const newUtxos = addressData.utxos.filter(
          (u) => !(u.txId === coinbase.id && u.outputIndex === 0)
        );

        // Remove a coinbase do histórico do endereço
        addressData.transactions =
          addressData.transactions?.filter((t) => t.tx.id !== coinbase.id) ||
          [];

        tempUtxoSet[address] = {
          ...addressData,
          balance: Math.max(0, addressData.balance - coinbase.outputs[0].value),
          utxos: newUtxos,
        };
      }
    }

    // Atualiza o UTXO set real forçando uma nova referência para reatividade
    this.balances = { ...tempUtxoSet };
  }

  updateWalletFromBalances() {
    if (!this.wallet || !this.wallet.addresses) return;

    for (const addressObj of this.wallet.addresses) {
      for (const bipType of Object.keys(addressObj) as BipType[]) {
        const addressData = addressObj[bipType];
        const balanceData = this.balances[addressData.address];
        if (balanceData) {
          addressData.balance = balanceData.balance;
          addressData.utxos = balanceData.utxos;
          addressData.transactions = balanceData.transactions;
        } else {
          addressData.balance = 0;
          addressData.utxos = [];
          addressData.transactions = [];
        }
      }
    }

    // Força mudança de referência para detecção pelo Angular
    this.wallet = { ...this.wallet };
  }

  public addTransaction(
    tx: Transaction,
    event?: NodeEvent,
    logTxData: boolean = true,
    isLocal: boolean = false
  ): { success: boolean; error?: string } {
    if (!this.currentBlock)
      return { success: false, error: 'Bloco atual não existe.' };
    if (this.currentBlock.transactions.find((t) => t.id === tx.id))
      return { success: false, error: 'Transação já existe no bloco atual.' };

    // --- Validação de duplo gasto intra-bloco (exceto modo malicioso local) ---
    if (!(this.isMalicious && isLocal)) {
      // Cria um set de todos os UTXOs já usados como input no bloco atual
      const usedInputs = new Set<string>();
      for (const t of this.currentBlock.transactions) {
        for (const input of t.inputs) {
          usedInputs.add(`${input.txid}:${input.vout}`);
        }
      }
      // Verifica se algum input da nova tx já foi usado
      for (const input of tx.inputs) {
        if (usedInputs.has(`${input.txid}:${input.vout}`)) {
          // Mensagem de erro visual
          if (event) {
            EventManager.log(event, 'transaction-rejected', {
              reason:
                'Duplo gasto: este UTXO já foi usado por outra transação no bloco atual.',
              txId: tx.id,
            });
            EventManager.fail(event);
          }
          return {
            success: false,
            error:
              'Duplo gasto: este UTXO já foi usado por outra transação no bloco atual.',
          };
        }
      }
    }

    // Só permite adicionar transação inválida se for malicioso E local
    if (this.isMalicious && isLocal) {
      this.currentBlock.addTransaction(tx);
      this.updateCoinbaseFees();
      // Gerenciar UTXOs virtuais: primeiro adicionar outputs, depois remover inputs
      this.addVirtualUtxos(tx);
      this.removeVirtualUtxos(tx);
      if (event) {
        EventManager.log(event, 'transaction-added', logTxData ? { tx } : {});
      } else {
        const txEvent = this.addEvent('transaction-added', { tx });
        EventManager.complete(txEvent);
      }
      return { success: true };
    }

    // Validação normal (honesta) para qualquer transação não-local ou não-maliciosa
    const { valid, reason } = this.isValidTransaction(tx);
    if (!valid)
      return { success: false, error: reason || 'Transação inválida.' };

    this.currentBlock.addTransaction(tx);
    this.updateCoinbaseFees();

    // Gerenciar UTXOs virtuais: primeiro adicionar outputs, depois remover inputs
    this.addVirtualUtxos(tx);
    this.removeVirtualUtxos(tx);

    if (event) {
      EventManager.log(event, 'transaction-added', logTxData ? { tx } : {});
    } else {
      const txEvent = this.addEvent('transaction-added', { tx });
      EventManager.complete(txEvent);
    }
    return { success: true };
  }

  // Atualiza as fees da coinbase sem recalcular o hash do bloco
  private updateCoinbaseFees(): void {
    if (!this.currentBlock || this.currentBlock.transactions.length === 0)
      return;

    const coinbase = this.currentBlock.transactions[0];
    if (!coinbase || coinbase.inputs.length > 0) return; // Não é coinbase

    const subsidy = this.calculateBlockSubsidy(this.currentBlock.height);

    // Calcula as fees das transações do bloco (exceto coinbase)
    let totalFees = 0;
    for (let i = 1; i < this.currentBlock.transactions.length; i++) {
      const tx = this.currentBlock.transactions[i];
      const inputSum = tx.inputs.reduce(
        (sum, input) => sum + (input.value || 0),
        0
      );
      const outputSum = tx.outputs.reduce((sum, o) => sum + o.value, 0);
      const fee = Math.max(0, inputSum - outputSum);
      totalFees += fee;
    }

    // Atualiza apenas o valor da coinbase
    coinbase.outputs[0].value = subsidy + totalFees;
  }

  broadcastTransaction(tx: Transaction, fromPeerId?: number) {
    this.transactionBroadcast$.next({ tx, fromPeerId });
  }

  onPeerTransactionReceived(tx: Transaction, peer: Node) {
    // 1. Cria evento de recebimento
    const receiveEvent = this.addEvent('transaction-received', {
      peerId: peer.id,
      tx,
    });

    // 2. Se já está no bloco atual, loga e finaliza
    if (
      this.currentBlock &&
      this.currentBlock.transactions.find((t) => t.id === tx.id)
    ) {
      EventManager.log(receiveEvent, 'duplicate-transaction', {
        reason: 'Transação já existe no bloco atual, ignorando.',
      });
      EventManager.complete(receiveEvent);
      return;
    }

    // 3. Se não há currentBlock, crie um automaticamente
    if (!this.currentBlock) {
      const lastBlock = this.getLatestBlock();
      this.initBlockTemplate(lastBlock);
    }

    // 4. Log de validação
    EventManager.log(receiveEvent, 'validating-transaction', {
      txId: tx.id,
      peerId: peer.id,
    });

    // 5. Sempre valide honestamente transações recebidas de outros peers
    const { valid, reason } = this.isValidTransaction(tx);
    if (!valid) {
      EventManager.log(receiveEvent, 'transaction-rejected', {
        reason: reason || 'Transação inválida',
      });
      EventManager.fail(receiveEvent);
      return;
    }

    // 6. Adicione ao bloco atual (passando o evento de recebimento)
    this.addTransaction(tx, receiveEvent, false, false); // isLocal = false

    // 7. Propague para outros peers (exceto o de origem)
    this.broadcastTransaction(tx, peer.id);

    // 8. Completa o evento de recebimento
    EventManager.complete(receiveEvent);
  }

  isValidTransaction(tx: Transaction): { valid: boolean; reason?: string } {
    // 1. Validação básica de estrutura
    if (
      !tx.id ||
      !tx.inputs ||
      !tx.outputs ||
      tx.inputs.length === 0 ||
      tx.outputs.length === 0
    ) {
      return { valid: false, reason: 'Estrutura da transação inválida' };
    }

    // 2. Validação de inputs (UTXOs)
    let totalInputValue = 0;
    for (const input of tx.inputs) {
      // Verifica se o UTXO existe no estado atual
      const utxo = this.findUtxo(input.txid, input.vout);
      if (!utxo) {
        return {
          valid: false,
          reason: `UTXO não encontrado (${input.txid}:${input.vout})`,
        };
      }

      // Verifica se o endereço do input corresponde ao UTXO
      if (utxo.output.scriptPubKey.address !== input.scriptPubKey.address) {
        return {
          valid: false,
          reason: 'Endereço do input não corresponde ao UTXO',
        };
      }

      // Verifica se o valor do input corresponde ao UTXO
      if (utxo.output.value !== input.value) {
        return {
          valid: false,
          reason: 'Valor do input não corresponde ao UTXO',
        };
      }

      totalInputValue += input.value;
    }

    // 3. Validação de outputs
    let totalOutputValue = 0;
    for (const output of tx.outputs) {
      if (output.value <= 0) {
        return { valid: false, reason: 'Valor de output inválido' };
      }
      totalOutputValue += output.value;
    }

    // 4. Validação de valores (inputs >= outputs)
    if (totalInputValue < totalOutputValue) {
      return {
        valid: false,
        reason: `Fundos insuficientes (${totalInputValue} < ${totalOutputValue})`,
      };
    }

    // 5. Validação de assinaturas
    for (const input of tx.inputs) {
      if (!input.scriptSig || input.scriptSig.length === 0) {
        return { valid: false, reason: 'Assinatura ausente no input' };
      }

      if (
        !this.verifySignature(
          input.scriptSig,
          input.scriptPubKey.pubKey,
          input.txid,
          input.vout
        )
      ) {
        return { valid: false, reason: 'Assinatura inválida' };
      }
    }

    // 6. Verifica se não é uma transação duplicada
    if (this.isTransactionDuplicate(tx.id)) {
      return { valid: false, reason: 'Transação duplicada' };
    }

    return { valid: true };
  }

  // Método auxiliar para encontrar um UTXO específico
  private findUtxo(
    txId: string,
    vout: number
  ): { output: { value: number; scriptPubKey: ScriptPubKey } } | null {
    // 1. Primeiro procura nos UTXOs virtuais do bloco atual
    const virtualKey = `${txId}:${vout}`;
    const virtualUtxo = this.virtualUtxos.get(virtualKey);
    if (virtualUtxo) {
      return virtualUtxo;
    }

    // 2. Se não encontrou nos virtuais, procura nos UTXOs confirmados da blockchain
    // MAS primeiro verifica se não foi gasto no bloco atual
    if (this.currentBlock) {
      // Cria um set de todos os UTXOs já gastos no bloco atual
      const spentInputs = new Set<string>();
      for (const tx of this.currentBlock.transactions) {
        for (const input of tx.inputs) {
          spentInputs.add(`${input.txid}:${input.vout}`);
        }
      }

      // Se este UTXO foi gasto no bloco atual, não está disponível
      if (spentInputs.has(virtualKey)) {
        return null;
      }
    }

    // 3. Agora procura nos UTXOs confirmados (que não foram gastos no bloco atual)
    for (const addressData of Object.values(this.balances)) {
      if (!addressData) continue;

      const utxo = addressData.utxos.find(
        (u) => u.txId === txId && u.outputIndex === vout
      );
      if (utxo) {
        return {
          output: {
            value: utxo.output.value,
            scriptPubKey: utxo.output.scriptPubKey,
          },
        };
      }
    }

    return null;
  }

  // Método para adicionar UTXOs virtuais de uma transação
  private addVirtualUtxos(tx: Transaction): void {
    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i];
      const virtualKey = `${tx.id}:${i}`;
      this.virtualUtxos.set(virtualKey, {
        output: {
          value: output.value,
          scriptPubKey: output.scriptPubKey,
        },
      });
    }
  }

  // Método para remover UTXOs virtuais gastos por uma transação
  private removeVirtualUtxos(tx: Transaction): void {
    for (const input of tx.inputs) {
      const virtualKey = `${input.txid}:${input.vout}`;
      const wasRemoved = this.virtualUtxos.delete(virtualKey);
    }
  }

  // Método para limpar todos os UTXOs virtuais (quando o bloco é minerado ou descartado)
  private clearVirtualUtxos(): void {
    this.virtualUtxos.clear();
  }

  // Método auxiliar para verificar se uma transação já existe
  private isTransactionDuplicate(txId: string): boolean {
    // Verifica se já existe no bloco atual
    if (
      this.currentBlock &&
      this.currentBlock.transactions.find((t) => t.id === txId)
    ) {
      return true;
    }

    // Verifica se já existe em algum bloco da blockchain
    for (const height of this.heights) {
      for (const blockNode of height.blocks) {
        if (blockNode.block.transactions.find((t) => t.id === txId)) {
          return true;
        }
      }
    }

    return false;
  }

  // Novo método: verifica duplicidade apenas no ramo do bloco (ancestrais), ignorando o próprio bloco
  private isTransactionDuplicateInBranch(txId: string, block: Block): boolean {
    // Começa do bloco pai
    let currentBlock: Block | undefined = this.getBlockByHeight(
      block.height - 1,
      block.previousHash
    );
    while (currentBlock) {
      if (currentBlock.transactions.some((tx) => tx.id === txId)) {
        return true;
      }
      currentBlock = this.getBlockByHeight(
        currentBlock.height - 1,
        currentBlock.previousHash
      );
    }
    return false;
  }

  // Método auxiliar para verificar assinatura
  private verifySignature(
    scriptSig: string,
    scriptPubKey: string,
    txId: string,
    vout: number
  ): boolean {
    try {
      // Verifica se a assinatura não está vazia
      if (!scriptSig || scriptSig.length === 0) {
        return false;
      }

      // Verifica se é um formato hexadecimal válido
      if (!/^[0-9a-fA-F]+$/.test(scriptSig)) {
        return false;
      }

      // Verifica se a assinatura tem formato DER válido
      if (scriptSig.length < 70) {
        return false;
      }

      // Cria a mensagem que foi assinada
      const message = `${txId}|${vout}|${scriptPubKey}`;

      // Em um sistema real, aqui extrairia a chave pública do scriptPubKey
      // Por enquanto, vamos simular que o scriptPubKey contém a chave pública
      // ou que podemos extraí-la do endereço

      try {
        // Tenta usar o scriptPubKey como chave pública diretamente
        const key = ec.keyFromPublic(scriptPubKey, 'hex');
        const isValid = key.verify(message, scriptSig);
        return isValid;
      } catch (keyError) {
        // Se não conseguir extrair a chave pública, tenta uma abordagem alternativa
        // Em um sistema real, aqui extrairia a chave pública do scriptPubKey de forma correta

        // Fallback: verifica se a assinatura tem formato válido
        // Em um sistema real, aqui implementaria a extração correta da chave pública
        return scriptSig.length >= 70 && /^[0-9a-fA-F]+$/.test(scriptSig);
      }
    } catch (error) {
      return false;
    }
  }

  // Método público para consultar UTXOs virtuais disponíveis
  public getVirtualUtxos(): Map<
    string,
    { output: { value: number; scriptPubKey: ScriptPubKey } }
  > {
    return new Map(this.virtualUtxos);
  }

  // Método público para verificar se um UTXO foi gasto no bloco atual
  public isUtxoSpentInCurrentBlock(txId: string, vout: number): boolean {
    if (!this.currentBlock) return false;

    const virtualKey = `${txId}:${vout}`;
    for (const tx of this.currentBlock.transactions) {
      for (const input of tx.inputs) {
        if (`${input.txid}:${input.vout}` === virtualKey) {
          return true;
        }
      }
    }
    return false;
  }
}
