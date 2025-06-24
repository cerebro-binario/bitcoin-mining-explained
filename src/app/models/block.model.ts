import { sha256 } from 'js-sha256';
import { NodeEvent, NodeEventLog } from './event-log.model';

export class Block {
  id: number = 0;
  height: number = 0;
  timestamp: number = Date.now();
  previousHash: string = '';
  hash: string = '';
  nonce: number = 0;
  transactions: Transaction[] = [];
  nBits: number = 0; // Compact representation of target
  private _target: string = '0'; // Store target as string for JSON serialization
  minerId?: number; // ID do minerador que minerou o bloco
  consensusVersion: number = 1; // Versão do consenso que o bloco foi minerado

  // Cronômetro de mineração
  miningElapsed: number = 0;

  merkleRoot: string = '';

  constructor(init?: Partial<Block>) {
    if (init) {
      // Handle target conversion if it exists in init
      if (init.target !== undefined) {
        this._target =
          typeof init.target === 'bigint'
            ? init.target.toString()
            : String(init.target);
        delete init.target; // Remove from init to avoid Object.assign issues
      }

      Object.assign(this, init);

      // Calculate target from nBits if provided
      if (init.nBits) {
        this.calculateTarget();
      }
    }
  }

  get target(): bigint {
    return BigInt('0x' + this._target);
  }

  set target(value: bigint) {
    this._target = value.toString(16);
  }

  public calculateTarget(): void {
    // Convert nBits to target
    const exponent = this.nBits >> 24;
    const mantissa = this.nBits & 0x00ffffff;
    this.target = BigInt(mantissa) * BigInt(2) ** BigInt(8 * (exponent - 3));
  }

  setNBits(nBits: number): void {
    this.nBits = nBits;
    this.calculateTarget();
  }

  // Add toJSON method to ensure proper serialization
  toJSON(): any {
    return {
      ...this,
      target: this._target, // Use string representation for JSON
    };
  }

  public calculateHash(): string {
    const data = {
      height: this.height,
      timestamp: this.timestamp,
      previousHash: this.previousHash,
      transactions: this.transactions,
      nonce: this.nonce,
      nBits: this.nBits,
    };
    return sha256(JSON.stringify(data));
  }

  public isHashBelowTarget(): boolean {
    if (!this.hash) return false;

    // Convert hash to BigInt for comparison
    const hashValue = BigInt('0x' + this.hash);

    // Block is valid if hash is below target
    return hashValue < this.target;
  }

  public calculateMerkleRoot(): string {
    if (!this.transactions.length) return '';
    let hashes = this.transactions.map((tx) => sha256(JSON.stringify(tx)));
    while (hashes.length > 1) {
      if (hashes.length % 2 !== 0) hashes.push(hashes[hashes.length - 1]);
      const newHashes: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        newHashes.push(sha256(hashes[i] + hashes[i + 1]));
      }
      hashes = newHashes;
    }
    return hashes[0];
  }

  public addTransaction(tx: Transaction): void {
    this.transactions.push(tx);
  }
}

export interface Transaction {
  id: string;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  signature: string;
}

export interface TransactionInput {
  txid: string; // ID da transação que criou o UTXO
  vout: number; // Índice do output na transação anterior
  scriptSig: string; // Assinatura do input
  scriptPubKey: string; // Endereço do dono do UTXO
  value: number; // Valor do UTXO em satoshis
}

export interface TransactionOutput {
  value: number; // Valor em satoshis
  scriptPubKey: string; // Script de bloqueio (endereço do destinatário)
}

// Representa um nó na árvore de blocos
export class BlockNode {
  block: Block;
  children: BlockNode[] = [];
  parent?: BlockNode;
  isActive: boolean = true; // Flag para indicar se o bloco faz parte de uma chain válida
  events: (NodeEvent | NodeEventLog)[] = [];

  constructor(block: Block, parent?: BlockNode) {
    this.block = block;
    this.parent = parent;
  }

  // Serializa a árvore sem o campo parent
  static serializeBlockNode(node: BlockNode): any {
    return {
      block: node.block,
      children: node.children.map(BlockNode.serializeBlockNode),
      isActive: node.isActive,
    };
  }

  // Desserializa a árvore e atribui parent
  static deserializeBlockNode(data: any, parent?: BlockNode): BlockNode {
    const node = new BlockNode(new Block(data.block), parent);
    node.isActive = data.isActive;
    node.children = (data.children || []).map((child: any) =>
      BlockNode.deserializeBlockNode(child, node)
    );
    return node;
  }
}

export function generateTransactionId(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  timestamp: number
): string {
  return sha256(JSON.stringify({ inputs, outputs, timestamp }));
}
