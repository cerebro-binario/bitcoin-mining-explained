export interface BitcoinAddressType {
  code: string;
  name: string;
  description: string;
}

export interface BitcoinAddressInfo {
  type: BitcoinAddressType;
  address: string;
  balance?: number;
}

export interface BitcoinAddresses {
  P2PKH: BitcoinAddressInfo;
  P2SH: BitcoinAddressInfo;
  P2WPKH: BitcoinAddressInfo;
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  addresses: BitcoinAddresses;
}

export const BITCOIN_ADDRESS_TYPES: { [key: string]: BitcoinAddressType } = {
  P2PKH: {
    code: 'P2PKH',
    name: 'Pay-to-Public-Key-Hash',
    description: 'Endereço Bitcoin tradicional (começa com 1)',
  },
  P2SH: {
    code: 'P2SH',
    name: 'Pay-to-Script-Hash',
    description: 'Endereço Bitcoin compatível com multisig (começa com 3)',
  },
  P2WPKH: {
    code: 'P2WPKH',
    name: 'Pay-to-Witness-Public-Key-Hash',
    description: 'Endereço Bitcoin SegWit (começa com bc1)',
  },
};

export const MAX_PRIVATE_KEY =
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141';
