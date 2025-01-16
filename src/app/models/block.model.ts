import { Transaction } from './transaction.model';

export interface Block {
  previousHash: string;
  height: number;
  transactions: Transaction[];
  timestamp: number;
  merkleRoot: string;
  nonce: number;
  hash: string;
}
