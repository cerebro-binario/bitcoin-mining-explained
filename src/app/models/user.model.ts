import { Keys } from './node';

export interface BitcoinAddressData {
  keys: Keys;
  address: string;
}

export type BipType = 'bip44' | 'bip49' | 'bip84';

export const BIP_TYPES: BipType[] = ['bip44', 'bip49', 'bip84'];

export type BitcoinAddress = {
  [key in BipType]: BitcoinAddressData;
};

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
