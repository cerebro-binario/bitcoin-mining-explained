export interface Neighbor {
  nodeId: number;
  latency: number;
}

export class BitcoinNode {
  id?: number;
  neighbors: Neighbor[] = [];
  distance: number = 50; // compatibilidade, pode ser removido depois

  // Campos para minerador
  isMiner: boolean = false;
  name?: string;
  hashRate?: number;

  constructor(init?: Partial<BitcoinNode>) {
    Object.assign(this, init);
  }
}
