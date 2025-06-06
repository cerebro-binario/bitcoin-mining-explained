import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import * as CryptoJS from 'crypto-js';
import { User } from '../../../../models/user.model';
import { KeyService } from '../../../../services/key.service';
import { Keys } from '../../../../models/node';

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

  copiedSeed = false;

  seedConfirmed = false;

  importSeed = '';
  importSeedPassphrase = '';
  importSeedError = '';

  // Propriedades para gerenciar a exibição das chaves
  showingKeys: boolean[] = [];
  addressKeys: Keys[] = [];

  // Tipo de endereço selecionado
  selectedAddressType: 'p2pkh' | 'p2sh_p2wpkh' | 'p2wpkh' = 'p2wpkh';

  constructor(public keyService: KeyService) {}

  get wallet() {
    return this.user.wallet;
  }

  get addresses(): string[] {
    if (!this.user.wallet?.addresses?.length) return [];
    return this.user.wallet.addresses.map(
      (addr) => addr[this.selectedAddressType]
    );
  }

  gerarMaisEnderecos() {
    if (!this.user.wallet?.seed?.length) return;

    const mnemonic = this.user.wallet.seed.join(' ');
    const passphrase = this.user.wallet.seedPassphrase || '';
    const currentCount = this.user.wallet.addresses?.length || 0;
    const newCount = 10;

    try {
      // Converte mnemônico para seed usando PBKDF2
      const seedBytes = mnemonicToSeedSync(mnemonic, passphrase);
      const seed = KeyService.bytesToHex(seedBytes);

      // Deriva as novas chaves usando BIP84
      const keys = this.keyService.deriveKeysFromSeed(
        seed,
        newCount,
        "m/84'/0'/0'"
      );

      // Gera os endereços para cada chave
      const newAddresses = keys.map((key) => ({
        privateKey: key.priv,
        publicKey: key.pub,
        path: key.path || '',
        p2pkh: this.keyService.generateBitcoinAddress(key.pub, 'p2pkh'),
        p2sh_p2wpkh: this.keyService.generateBitcoinAddress(
          key.pub,
          'p2sh-p2wpkh'
        ),
        p2wpkh: this.keyService.generateBitcoinAddress(key.pub, 'p2wpkh'),
      }));

      // Adiciona os novos endereços à lista
      this.user.wallet.addresses = [
        ...(this.user.wallet.addresses || []),
        ...newAddresses,
      ];
    } catch (error) {
      console.error('Erro ao gerar mais endereços:', error);
    }
  }

  createWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'show-seed';
    this.user.wallet.seed = this.keyService.generateSeed().split(' ');
    this.user.wallet.seedPassphrase = '';
    this.user.wallet.addresses = [];
    this.seedConfirmed = false;
  }

  importWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'show-seed';
    this.importSeed = '';
    this.importSeedPassphrase = '';
    this.importSeedError = '';
  }

  confirmImportSeed() {
    if (!this.user.wallet) return;
    const words = this.importSeed.trim().split(/\s+/);
    if (words.length !== 12) {
      this.importSeedError = 'A seed deve conter exatamente 12 palavras.';
      return;
    }
    this.user.wallet.seed = words;
    this.user.wallet.seedPassphrase = this.importSeedPassphrase || '';
    this.user.wallet.step = 'set-passphrase';
    this.importSeedError = '';
    this.importSeed = '';
    this.importSeedPassphrase = '';
    setTimeout(() => {
      this.inputWalletPassphrase?.nativeElement.focus();
    }, 0);
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

    // Gera o primeiro endereço
    try {
      const mnemonic = this.user.wallet.seed.join(' ');
      const seedBytes = mnemonicToSeedSync(
        mnemonic,
        this.user.wallet.seedPassphrase
      );
      const seed = KeyService.bytesToHex(seedBytes);

      // Deriva a primeira chave usando BIP84
      const keys = this.keyService.deriveKeysFromSeed(seed, 1, "m/84'/0'/0'");

      // Gera o endereço com todos os formatos
      this.user.wallet.addresses = keys.map((key) => ({
        privateKey: key.priv,
        publicKey: key.pub,
        path: key.path || '',
        p2pkh: this.keyService.generateBitcoinAddress(key.pub, 'p2pkh'),
        p2sh_p2wpkh: this.keyService.generateBitcoinAddress(
          key.pub,
          'p2sh-p2wpkh'
        ),
        p2wpkh: this.keyService.generateBitcoinAddress(key.pub, 'p2wpkh'),
      }));
    } catch (error) {
      console.error('Erro ao gerar primeiro endereço:', error);
    }

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

  copySeedToClipboard() {
    if (!this.seed.length) return;
    const text = this.seed.join(' ');
    navigator.clipboard.writeText(text).then(() => {
      this.copiedSeed = true;
      setTimeout(() => (this.copiedSeed = false), 2000);
    });
  }

  // Métodos para gerenciar a exibição das chaves
  toggleAddressKeys(index: number): void {
    if (!this.user.wallet?.addresses?.[index]) return;
    this.showingKeys[index] = !this.showingKeys[index];
  }

  hasVisibleKeys(): boolean {
    return this.showingKeys && this.showingKeys.some((k) => k);
  }

  copyToClipboard(text: string | undefined): void {
    if (!text) return;
    navigator.clipboard.writeText(text);
  }

  // Método para alterar o tipo de endereço
  changeAddressType(type: 'p2pkh' | 'p2sh_p2wpkh' | 'p2wpkh'): void {
    this.selectedAddressType = type;
  }
}
