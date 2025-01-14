import { BitcoinAddress } from './address.model';

export type BalanceByAddress = {
  [address in BitcoinAddress]: number;
};
