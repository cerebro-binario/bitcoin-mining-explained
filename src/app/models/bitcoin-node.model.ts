import { Block } from './block.model';

export interface Neighbor {
  nodeId: number;
  latency: number;
}

// Representa um nó na árvore de blocos
export class BlockNode {
  block: Block;
  children: BlockNode[] = [];
  parent?: BlockNode;
  constructor(block: Block, parent?: BlockNode) {
    this.block = block;
    this.parent = parent;
  }

  // Serializa a árvore sem o campo parent
  static serializeBlockNode(node: BlockNode): any {
    return {
      block: node.block,
      children: node.children.map(BlockNode.serializeBlockNode),
    };
  }

  // Desserializa a árvore e atribui parent
  static deserializeBlockNode(data: any, parent?: BlockNode): BlockNode {
    const node = new BlockNode(new Block(data.block), parent);
    node.children = (data.children || []).map((child: any) =>
      BlockNode.deserializeBlockNode(child, node)
    );
    return node;
  }
}

export class BitcoinNode {
  id?: number;
  neighbors: Neighbor[] = [];

  // Campos para minerador
  isMiner: boolean = false;
  name: string = '';
  hashRate: number | null = null;
  currentHashRate: number = 0; // Hash rate real sendo alcançado
  currentBlock?: Block;
  isMining: boolean = false;
  miningInterval?: any;
  miningAddress: string = ''; // Endereço para receber recompensas de mineração

  // Cronômetro de mineração
  miningStartTime: number | null = null;
  miningElapsed: number = 0;
  miningTimer?: any;

  // Blockchain local do nó
  chains: Block[][] = [[]]; // chains[0] = cadeia principal, demais = forks alternativos
  lastBlockReceived?: BlockNode;
  lastBlockPropagated?: Block;
  genesis?: BlockNode; // raiz da árvore

  // Estrutura para organizar blocos por altura
  heights: BlockNode[][] = [];

  constructor(init?: Partial<BitcoinNode>) {
    Object.assign(this, init);
  }

  // Método para atualizar heights com um novo bloco
  updateHeights(node: BlockNode, height: number) {
    if (!this.heights[height]) this.heights[height] = [];
    this.heights[height].push(node);

    this.organizeBlocksByHeight();
  }

  // Adiciona um bloco à árvore de blocos
  addBlock(block: Block): boolean {
    // Se for o bloco genesis
    if (block.height === 0) {
      if (
        block.previousHash ===
        '0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        if (!this.genesis) {
          this.genesis = new BlockNode(block);
          this.lastBlockReceived = this.genesis;
          this.updateHeights(this.genesis, block.height);
          return true;
        } else {
          // Genesis já existe
          return false;
        }
      } else {
        return false;
      }
    }

    // Procura o pai na árvore
    const parent = this.findBlockNodeByHash(block.previousHash, this.genesis);
    if (!parent) return false;
    // Não aceita blocos duplicados
    if (this.findBlockNodeByHash(block.hash, this.genesis)) return false;
    // Adiciona como filho
    const node = new BlockNode(block, parent);
    parent.children.push(node);
    this.lastBlockReceived = node;
    // Reorganiza os filhos do pai para garantir que o mais longo fique no índice 0
    this.reorderChildrenByLongestPath(parent);
    this.updateHeights(node, block.height);
    return true;
  }

  // Busca um nó pelo hash na árvore
  findBlockNodeByHash(hash: string, node?: BlockNode): BlockNode | undefined {
    if (!node) return undefined;
    if (node.block.hash === hash) return node;
    for (const child of node.children) {
      const found = this.findBlockNodeByHash(hash, child);
      if (found) return found;
    }
    return undefined;
  }

  // Retorna o caminho mais longo (main chain) da árvore
  getMainChain(): Block[] {
    if (!this.genesis) return [];
    let maxPath: BlockNode[] = [];
    function dfs(node: BlockNode, path: BlockNode[]) {
      path.push(node);
      if (node.children.length === 0) {
        if (path.length > maxPath.length) {
          maxPath = [...path];
        }
      } else {
        for (const child of node.children) {
          dfs(child, path);
        }
      }
      path.pop();
    }
    dfs(this.genesis, []);
    return maxPath.map((n) => n.block);
  }

  // Retorna todos os forks (caminhos não principais)
  getForks(): Block[][] {
    if (!this.genesis) return [];
    const mainChain = this.getMainChain().map((b) => b.hash);
    const forks: Block[][] = [];
    function dfs(node: BlockNode, path: BlockNode[]) {
      path.push(node);
      if (node.children.length === 0) {
        // Se não é main chain, é fork
        const hashes = path.map((n) => n.block.hash);
        if (hashes.join('-') !== mainChain.join('-')) {
          forks.push(path.map((n) => n.block));
        }
      } else {
        for (const child of node.children) {
          dfs(child, path);
        }
      }
      path.pop();
    }
    dfs(this.genesis, []);
    return forks;
  }

  // Retorna o bloco mais avançado (maior altura) e, em caso de empate, o de menor latência
  getLatestBlock(): Block | undefined {
    if (!this.genesis) return undefined;

    // Percorre todos os caminhos até as folhas
    let maxHeight = -1;
    let candidates: BlockNode[] = [];
    const dfs = (node: BlockNode, height: number) => {
      if (node.children.length === 0) {
        if (height > maxHeight) {
          maxHeight = height;
          candidates = [node];
        } else if (height === maxHeight) {
          candidates.push(node);
        }
      } else {
        node.children.forEach((child) => dfs(child, height + 1));
      }
    };
    dfs(this.genesis, 0);

    if (candidates.length === 0) return undefined;
    // Se houver empate, retorna o de menor latência, que é sempre o primeiro
    return candidates[0].block;
  }

  // Retorna o bloco com a altura especificada da main chain
  getBlockByHeight(height: number): Block | undefined {
    const main = this.getMainChain();
    return main.find((block) => block.height === height);
  }

  // Serializa o nó para salvar no localStorage
  serialize(): any {
    const obj: any = { ...this };
    if (this.genesis) {
      obj.genesis = BlockNode.serializeBlockNode(this.genesis);
    }
    // Remove campos que não devem ser serializados
    delete obj.lastBlockReceived;
    delete obj.lastBlockPropagated;
    delete obj.heights; // Não serializa heights
    return obj;
  }

  // Desserializa um nó a partir do objeto salvo
  static deserialize(data: any): BitcoinNode {
    const node = new BitcoinNode(data);
    if (data.genesis) {
      node.genesis = BlockNode.deserializeBlockNode(data.genesis);
      // Recria a estrutura heights após desserializar
      node.organizeBlocksByHeight();
    }
    return node;
  }

  // Reorganiza os filhos do nó para que o caminho mais longo fique no índice 0
  private reorderChildrenByLongestPath(parent: BlockNode) {
    parent.children.sort((a, b) => {
      const lenA = this.getPathLength(a);
      const lenB = this.getPathLength(b);
      if (lenB !== lenA) return lenB - lenA;

      // Se empatar, prioriza menor latência em relação ao próprio nó (this)
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
      if (latencyA !== latencyB) return latencyA - latencyB;
      // Se ainda empatar, prioriza o minerId igual ao do próprio nó
      if (aMinerId === this.id && bMinerId !== this.id) return -1;
      if (bMinerId === this.id && aMinerId !== this.id) return 1;
      // Se ainda empatar, mantém a ordem
      return 0;
    });
  }

  // Retorna o comprimento do caminho mais longo a partir deste nó
  private getPathLength(node: BlockNode): number {
    if (node.children.length === 0) return 1;
    return (
      1 + Math.max(...node.children.map((child) => this.getPathLength(child)))
    );
  }

  // Método para organizar os blocos por altura
  organizeBlocksByHeight() {
    this.heights = [];
    if (!this.genesis) return;

    // Função recursiva para percorrer a árvore e organizar por altura
    const dfs = (node: BlockNode, height: number) => {
      if (!this.heights[height]) this.heights[height] = [];
      this.heights[height].push(node);
      node.children.forEach((child) => dfs(child, height + 1));
    };

    dfs(this.genesis, 0);

    // Ordena cada altura usando a mesma lógica de reorderChildrenByLongestPath
    this.heights.forEach((height) => {
      height.sort((a, b) => {
        const lenA = this.getPathLength(a);
        const lenB = this.getPathLength(b);
        if (lenB !== lenA) return lenB - lenA;

        // Se empatar, prioriza menor latência em relação ao próprio nó (this)
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
        if (latencyA !== latencyB) return latencyA - latencyB;
        // Se ainda empatar, prioriza o minerId igual ao do próprio nó
        if (aMinerId === this.id && bMinerId !== this.id) return -1;
        if (bMinerId === this.id && aMinerId !== this.id) return 1;
        // Se ainda empatar, mantém a ordem
        return 0;
      });
    });
  }
}
