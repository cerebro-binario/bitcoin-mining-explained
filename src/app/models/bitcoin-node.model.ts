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
  chains: Block[][] = [[]]; // chains[0] = cadeia principal, demais = forks alternativos
  lastBlockReceived?: Block;
  lastBlockPropagated?: Block;

  constructor(init?: Partial<BitcoinNode>) {
    Object.assign(this, init);
  }

  // Adiciona um bloco à blockchain local, suportando forks
  addBlock(block: Block): boolean {
    // Não aceita blocos duplicados em nenhuma cadeia
    if (this.chains.some((chain) => chain.some((b) => b.hash === block.hash))) {
      return false;
    }

    // Se for o bloco genesis
    if (block.height === 0) {
      if (
        block.previousHash ===
        '0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        if (this.chains[0].length === 0) {
          this.chains[0].push(block);
          this.lastBlockReceived = block;
          return true;
        } else {
          // Genesis já existe
          return false;
        }
      } else {
        return false;
      }
    }

    // Tenta adicionar à cadeia principal
    const mainChain = this.chains[0];
    const latest = mainChain[mainChain.length - 1];
    if (
      latest &&
      block.previousHash === latest.hash &&
      block.height === latest.height + 1
    ) {
      mainChain.push(block);
      this.lastBlockReceived = block;
      return true;
    }

    // Tenta adicionar a um fork existente
    for (let i = 1; i < this.chains.length; i++) {
      const fork = this.chains[i];
      const forkTip = fork[fork.length - 1];
      if (
        forkTip &&
        block.previousHash === forkTip.hash &&
        block.height === forkTip.height + 1
      ) {
        fork.push(block);
        this.lastBlockReceived = block;
        this.tryPromoteForks();
        return true;
      }
    }

    // Tenta criar um novo fork a partir de um bloco existente
    for (const chain of this.chains) {
      const forkPoint = chain.find((b) => b.hash === block.previousHash);
      if (forkPoint && block.height === forkPoint.height + 1) {
        // Cria novo fork a partir do forkPoint
        const fork = chain.slice(0, forkPoint.height + 1);
        fork.push(block);
        this.chains.push(fork);
        this.lastBlockReceived = block;
        this.tryPromoteForks();
        return true;
      }
    }

    // Não foi possível adicionar
    return false;
  }

  // Promove um fork alternativo para cadeia principal se for mais longo
  private tryPromoteForks() {
    let maxLen = this.chains[0].length;
    let mainIdx = 0;
    for (let i = 1; i < this.chains.length; i++) {
      if (this.chains[i].length > maxLen) {
        maxLen = this.chains[i].length;
        mainIdx = i;
      }
    }
    if (mainIdx !== 0) {
      // Troca a cadeia principal
      const newMain = this.chains[mainIdx];
      this.chains.splice(mainIdx, 1);
      this.chains.unshift(newMain);
    }
  }

  // Retorna o último bloco da cadeia principal
  getLatestBlock(): Block | undefined {
    const mainChain = this.chains[0];
    return mainChain[mainChain.length - 1];
  }

  // Retorna o bloco com a altura especificada da cadeia principal
  getBlockByHeight(height: number): Block | undefined {
    const mainChain = this.chains[0];
    return mainChain.find((block) => block.height === height);
  }

  // Retorna todos os forks alternativos
  getForks(): Block[][] {
    return this.chains.slice(1);
  }
}
