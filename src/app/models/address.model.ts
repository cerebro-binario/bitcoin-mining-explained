export type BitcoinAddressType = 'P2PKH' | 'P2SH' | 'P2WPKH';

export type BitcoinAddress = `1${string}` | `3${string}` | `bc1${string}`;

export type BitcoinAddressBalance = {
  type: BitcoinAddressType;
  address: BitcoinAddress;
  balance: number;
};

export type CoinbaseAddress =
  '0000000000000000000000000000000000000000000000000000000000000000';

export const COINBASE_ADDRESS =
  '0000000000000000000000000000000000000000000000000000000000000000';
