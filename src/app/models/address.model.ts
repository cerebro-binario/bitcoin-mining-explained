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

export const GENESIS_KEY_PAIR: KeyPair = {
  privateKey: (0x01).toString(),
  publicKey:
    '0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
  addresses: [
    {
      address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
      balance: 0,
      type: BITCOIN_ADDRESS_TYPES['P2PKH'],
    },
    {
      address: '3EyPVdtVrtMJ1XwPT9oiBrQysGpRY8LE9K',
      balance: 0,
      type: BITCOIN_ADDRESS_TYPES['P2SH'],
    },
    {
      address: 'bc1qjxeyh7049zzn99s2c6r6hvp4zfa362997dpu0h',
      balance: 0,
      type: BITCOIN_ADDRESS_TYPES['P2WPKH'],
    },
  ],
};
