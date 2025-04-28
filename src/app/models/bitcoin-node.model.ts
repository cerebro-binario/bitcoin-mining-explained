import { Block } from './block.model';

export interface Neighbor {
  nodeId: number;
  latency: number;
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
  blocks: Block[] = [];
  lastBlockReceived?: Block;
  lastBlockPropagated?: Block;

  constructor(init?: Partial<BitcoinNode>) {
    Object.assign(this, init);
  }

  // Adiciona um bloco à blockchain local
  addBlock(block: Block): boolean {
    // Verifica se o bloco é válido
    if (!this.isValidBlock(block)) {
      return false;
    }

    // Verifica se o bloco já existe
    if (this.blocks.some((b) => b.hash === block.hash)) {
      return false;
    }

    // Adiciona o bloco
    this.blocks.push(block);
    this.lastBlockReceived = block;
    return true;
  }

  // Verifica se um bloco é válido
  private isValidBlock(block: Block): boolean {
    // Verifica se é o bloco genesis
    if (block.height === 0) {
      return (
        block.previousHash ===
        '0000000000000000000000000000000000000000000000000000000000000000'
      );
    }

    // Verifica se o bloco anterior existe
    const previousBlock = this.blocks.find(
      (b) => b.hash === block.previousHash
    );
    if (!previousBlock) {
      return false;
    }

    // Verifica se a altura está correta
    if (block.height !== previousBlock.height + 1) {
      return false;
    }

    // Verifica se o hash do bloco é válido
    const hash = block.calculateHash();
    if (block.hash !== hash) {
      return false;
    }

    return true;
  }

  // Retorna o último bloco da blockchain
  getLatestBlock(): Block | undefined {
    return this.blocks[this.blocks.length - 1];
  }

  // Retorna o bloco com a altura especificada
  getBlockByHeight(height: number): Block | undefined {
    return this.blocks.find((block) => block.height === height);
  }
}
