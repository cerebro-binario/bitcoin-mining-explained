import { sha256 } from 'js-sha256';

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

  // Cronômetro de mineração
  miningStartTime: number | null = null;
  miningElapsed: number = 0;
  miningTimer?: any;

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
}

export interface TransactionOutput {
  value: number; // Valor em satoshis
  scriptPubKey: string; // Script de bloqueio (endereço do destinatário)
}

// export const GENESIS_BLOCK: Block = {
//   previousHash:
//     '0000000000000000000000000000000000000000000000000000000000000000',
//   height: 0,
//   transactions: [
//     {
//       txid: '54e39cc08806e3809f279abac25867ae3206c5892eb1df69ac51b7c5dbe11be0',
//       fee: 0,
//       transfers: [
//         {
//           amount: 50.0,
//           to: GENESIS_KEY_PAIR.addresses['P2PKH'].address,
//           from: '0000000000000000000000000000000000000000000000000000000000000000',
//         },
//       ],
//     },
//   ],
//   timestamp: 1737069357,
//   hash: '0000d590a982a9489b64e91cea5e8f81635c56718b1c459041bd3a3a189cf6aa',
//   merkleRoot:
//     '54e39cc08806e3809f279abac25867ae3206c5892eb1df69ac51b7c5dbe11be0',
//   nonce: 346257,
// };

export const INITIAL_SUBSIDY = 50 * 100000000;
export const N_BLOCKS_PER_HALVING = 210000;
