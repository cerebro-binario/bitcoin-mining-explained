export interface BitcoinAddress {
  // Chaves
  privateKey: string;
  publicKey: string;

  // Endereços em diferentes formatos
  p2pkh: string; // Legacy (1...)
  p2sh_p2wpkh: string; // SegWit Compatível (3...)
  p2wpkh: string; // Native SegWit (bc1...)

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
  addresses: BitcoinAddress[];
}

export interface User {
  id: number;
  name: string;
  wallet?: UserWallet;
}
