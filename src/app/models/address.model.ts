export type BitcoinAddressTypeCode = 'P2PKH' | 'P2SH' | 'P2WPKH';

export type BitcoinAddressType = {
  code: BitcoinAddressTypeCode;
  name: string;
};

export const BITCOIN_ADDRESS_TYPES: {
  [code in BitcoinAddressTypeCode]: BitcoinAddressType;
} = {
  P2PKH: { code: 'P2PKH', name: 'P2PKH (Legacy)' },
  P2SH: { code: 'P2SH', name: 'P2SH (Multisig)' },
  P2WPKH: { code: 'P2WPKH', name: 'P2WPKH (SegWit - Bech32)' },
};

export type BitcoinAddress = `1${string}` | `3${string}` | `bc1${string}`;

export type BitcoinAddressInfo = {
  type: BitcoinAddressType;
  address: BitcoinAddress;
  balance: number;
};

export type KeyPair = {
  privateKey: string;
  publicKey: string;
  addresses: BitcoinAddressInfo[];
};

export type KeyPairByAddress = {
  [address in BitcoinAddress]: KeyPair;
};

export type CoinbaseAddress =
  '0000000000000000000000000000000000000000000000000000000000000000';

export const COINBASE_ADDRESS =
  '0000000000000000000000000000000000000000000000000000000000000000';

export const MAX_PRIVATE_KEY =
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140';
