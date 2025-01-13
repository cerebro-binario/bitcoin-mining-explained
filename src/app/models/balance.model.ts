import { BitcoinAddress } from './address.model';

export type Balances = {
  [address in BitcoinAddress]: number;
};
