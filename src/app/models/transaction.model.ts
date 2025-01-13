import { Transfer } from './transfer.model';

export interface Transaction {
  txid: string;
  transfers: Transfer[];
  fee: number;
}
