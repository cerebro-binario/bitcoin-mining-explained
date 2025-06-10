export interface Keys {
  priv: string;
  pub: string;
  xpriv?: string;
  xpub?: string;
  path?: string; // Caminho de derivação BIP32 (opcional para compatibilidade)
}

export interface BitcoinUTXO {
  output: {
    value: number;
    scriptPubKey: string;
  };
  blockHeight: number;
  txId: string;
  outputIndex: number;
}

export interface BitcoinAddressData {
  nodeName?: string;
  keys: Keys;
  address: string;
  balance: number;
  utxos: BitcoinUTXO[];
}

export type BipType = 'bip44' | 'bip49' | 'bip84';

export const BIP_TYPES: BipType[] = ['bip44', 'bip49', 'bip84'];

export type BitcoinAddress = {
  [key in BipType]: BitcoinAddressData;
};

export interface Wallet {
  step:
    | 'choose'
    | 'show-seed'
    | 'confirm-seed'
    | 'set-seed-passphrase'
    | 'set-passphrase'
    | 'created';
  seed: string[];
  seedPassphrase: string;
  passphrase: string;
  addresses: BitcoinAddress[];
}
