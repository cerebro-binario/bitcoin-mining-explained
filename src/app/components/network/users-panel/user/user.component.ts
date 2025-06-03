import { Component, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User, UserWallet } from '../../../../models/user.model';
import * as CryptoJS from 'crypto-js';

const MOCK_WORDLIST = [
  'apple',
  'banana',
  'cat',
  'dog',
  'elephant',
  'fish',
  'grape',
  'hat',
  'ice',
  'jungle',
  'kite',
  'lemon',
  'monkey',
  'nose',
  'orange',
  'pear',
  'queen',
  'rose',
  'sun',
  'tree',
  'umbrella',
  'violet',
  'wolf',
  'xray',
  'yarn',
  'zebra',
];

function generateMockSeed(numWords = 12): string[] {
  const words = [];
  for (let i = 0; i < numWords; i++) {
    const idx = Math.floor(Math.random() * MOCK_WORDLIST.length);
    words.push(MOCK_WORDLIST[idx]);
  }
  return words;
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user.component.html',
})
export class UserComponent {
  @Input() user!: User;
  @ViewChild('inputSeedPassphrase')
  inputSeedPassphrase?: ElementRef<HTMLInputElement>;
  @ViewChild('inputWalletPassphrase')
  inputWalletPassphrase?: ElementRef<HTMLInputElement>;

  passphrase = '';
  passphraseConfirm = '';
  passphraseError = '';

  seedPassphrase = '';
  seedPassphraseError = '';

  numAddresses = 10;

  get wallet() {
    return this.user.wallet;
  }

  // Deriva numAddresses endereços determinísticos a partir da seed+passphrase
  get addresses(): string[] {
    if (!this.user.wallet?.seed?.length) return [];
    const seed = this.user.wallet.seed.join(' ');
    const passphrase = this.user.wallet.seedPassphrase || '';
    const addresses: string[] = [];
    const num = this.user.wallet.numAddresses || 10;
    for (let i = 0; i < num; i++) {
      const input = `${seed}|${passphrase}|${i}`;
      const hash = CryptoJS.SHA256(input).toString();
      // Simula um endereço bech32 (bc1...)
      addresses.push('bc1' + hash.slice(0, 38));
    }
    return addresses;
  }

  gerarMaisEnderecos() {
    if (this.user.wallet) {
      this.user.wallet.numAddresses =
        (this.user.wallet.numAddresses || 10) + 10;
    }
  }

  createWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'show-seed';
    this.user.wallet.seed = generateMockSeed();
    this.user.wallet.seedPassphrase = '';
  }

  importWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'created';
    this.user.wallet.seed = [];
    this.user.wallet.seedPassphrase = '';
    // Lógica de importação de wallet virá depois
  }

  continueAfterSeed() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'set-seed-passphrase';
    setTimeout(() => {
      this.inputSeedPassphrase?.nativeElement.focus();
    }, 0);
  }

  setSeedPassphrase() {
    if (!this.user.wallet) return;
    // Não é obrigatório, pode ser vazio
    this.user.wallet.seedPassphrase = this.seedPassphrase || '';
    this.user.wallet.step = 'set-passphrase';
    this.seedPassphrase = '';
    this.seedPassphraseError = '';
    setTimeout(() => {
      this.inputWalletPassphrase?.nativeElement.focus();
    }, 0);
  }

  setPassphrase() {
    if (!this.user.wallet) return;
    if (!this.passphrase || !this.passphraseConfirm) {
      this.passphraseError = 'Digite e confirme a senha.';
      return;
    }
    if (this.passphrase !== this.passphraseConfirm) {
      this.passphraseError = 'As senhas não coincidem.';
      return;
    }
    this.user.wallet.passphrase = this.passphrase;
    this.user.wallet.step = 'created';
    this.passphrase = '';
    this.passphraseConfirm = '';
    this.passphraseError = '';
  }

  get walletStep() {
    return this.user.wallet?.step;
  }

  get seed() {
    return this.user.wallet?.seed || [];
  }

  get walletExists() {
    return this.user.wallet?.step === 'created';
  }
}
