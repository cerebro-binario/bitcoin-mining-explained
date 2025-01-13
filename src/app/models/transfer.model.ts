import { BitcoinAddress, CoinbaseAddress } from './address.model';

export interface Transfer {
  from: BitcoinAddress | CoinbaseAddress;
  to: BitcoinAddress;
  amount: number;
}
