import * as CryptoJS from 'crypto-js';
import { Block, BlockNode, Transaction } from './block.model';
import { ConsensusParameters, DEFAULT_CONSENSUS } from './consensus.model';

export interface Neighbor {
  nodeId: number;
  latency: number;
}

export class Node {
  private readonly INITIAL_NBITS = 0x1e9fffff;
  private readonly SUBSIDY = 50 * 100000000; // 50 BTC em satoshis
  private readonly HALVING_INTERVAL = 210000; // Blocos até próximo halving

  isSyncing: boolean = true;
  initialSyncComplete: boolean = false;
  pendingBlocks: Block[] = [];
  isAddingBlock: boolean = false;

  // Rastreamento de peers durante o sync inicial
  syncPeers: {
    nodeId: number;
    latency: number;
    status: 'pending' | 'validating' | 'valid' | 'invalid';
    blockchainLength?: number;
    work?: number;
  }[] = [];

  // Log de eventos de propagação/validação de blocos
  eventLog: {
    type: 'block-received' | 'block-validated' | 'block-rejected';
    from?: number;
    blockHash: string;
    timestamp: number;
    reason?: string;
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
  consensus: ConsensusParameters = { ...DEFAULT_CONSENSUS };

  constructor(init?: Partial<Node>) {
    Object.assign(this, init);
  }

  initBlockTemplate(lastBlock?: Block): Block {
    const timestamp = Date.now();
    const previousHash =
      lastBlock?.hash ||
      '0000000000000000000000000000000000000000000000000000000000000000';
    const nBits = this.calculateNBits(lastBlock);
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
    });

    return this.currentBlock;
  }

  private calculateNBits(lastBlock?: Block): number {
    if (!lastBlock) return this.INITIAL_NBITS;

    // TODO: Implementar ajuste de nBits baseado no tempo de mineração do último bloco
    return this.INITIAL_NBITS;
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
      const neighbor = this.neighbors.find((n) => n.nodeId === aMinerId);
      if (neighbor) latencyA = neighbor.latency;
    }

    if (
      bMinerId !== undefined &&
      this.id !== undefined &&
      bMinerId === this.id
    ) {
      latencyB = 0;
    } else if (this.id !== undefined && bMinerId !== undefined) {
      const neighbor = this.neighbors.find((n) => n.nodeId === bMinerId);
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

  addBlock(block: Block): { success: boolean; reason?: string } {
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
}
