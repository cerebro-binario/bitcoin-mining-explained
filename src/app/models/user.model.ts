import { Wallet } from './wallet.model';

export interface User {
  id: number;
  name: string;
  wallet?: Wallet;
}
