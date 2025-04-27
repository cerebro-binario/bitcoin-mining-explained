import { GENESIS_KEY_PAIR } from './address.model';
// import { Transaction } from './transaction.model';

export class Block {
  id: number = 0;
  timestamp: number = Date.now();
  previousHash: string = '';
  hash: string = '';
  nonce: number = 0;
  transactions: Transaction[] = [];
  difficulty: number = 0;

  constructor(init?: Partial<Block>) {
    Object.assign(this, init);
  }
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  signature: string;
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
