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

  constructor(init?: Partial<BitcoinNode>) {
    Object.assign(this, init);
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

  // Retorna o último bloco da main chain
  getLatestBlock(): Block | undefined {
    const main = this.getMainChain();
    return main[main.length - 1];
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
    return obj;
  }

  // Desserializa um nó a partir do objeto salvo
  static deserialize(data: any): BitcoinNode {
    const node = new BitcoinNode(data);
    if (data.genesis) {
      node.genesis = BlockNode.deserializeBlockNode(data.genesis);
    }
    return node;
  }

  // Reorganiza os filhos do nó para que o caminho mais longo fique no índice 0
  private reorderChildrenByLongestPath(parent: BlockNode) {
    parent.children.sort(
      (a, b) => this.getPathLength(b) - this.getPathLength(a)
    );
  }

  // Retorna o comprimento do caminho mais longo a partir deste nó
  private getPathLength(node: BlockNode): number {
    if (node.children.length === 0) return 1;
    return (
      1 + Math.max(...node.children.map((child) => this.getPathLength(child)))
    );
  }
}
