export interface BitcoinAddress {
  // Chaves
  privateKey: string;
  publicKey: string;

  // Endereços em diferentes formatos
  address: string;

  // Caminho de derivação
  path: string;
}

export interface UserWallet {
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
  addresses: {
    bip44: BitcoinAddress[];
    bip49: BitcoinAddress[];
    bip84: BitcoinAddress[];
  };
}

export interface User {
  id: number;
  name: string;
  wallet?: UserWallet;
}
