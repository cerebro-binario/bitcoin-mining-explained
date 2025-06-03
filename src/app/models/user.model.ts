export interface UserWallet {
  step:
    | 'choose'
    | 'show-seed'
    | 'set-seed-passphrase'
    | 'set-passphrase'
    | 'created';
  seed: string[];
  passphrase?: string; // senha de acesso ao app
  seedPassphrase?: string; // 13ª palavra opcional
}

export interface User {
  id: number;
  name: string;
  wallet?: UserWallet;
}
