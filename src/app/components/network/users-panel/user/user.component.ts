import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mnemonicToSeedSync } from '@scure/bip39';
import { TableModule } from 'primeng/table';
import { User } from '../../../../models/user.model';
import { BitcoinAddress } from '../../../../models/wallet.model';
import { BitcoinNetworkService } from '../../../../services/bitcoin-network.service';
import { KeyService } from '../../../../services/key.service';
import { bytesToHex } from '../../../../utils/tools';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule],
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

  // Tipo de endereço selecionado
  selectedAddressType: 'bip44' | 'bip49' | 'bip84' = 'bip84';

  constructor(
    public keyService: KeyService,
    private networkService: BitcoinNetworkService
  ) {}

  deriveNextAddress() {
    if (!this.user.wallet) return;

    const newAddress = this.keyService.deriveNextBitcoinAddress(
      this.user.wallet
    );

    if (newAddress) {
      this.user.wallet.addresses = [...this.user.wallet.addresses, newAddress];
      this.networkService.updateUser(this.user);
    }
  }

  createWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'show-seed';
    this.user.wallet.seed = this.keyService.generateSeed();
    this.user.wallet.seedPassphrase = '';
    this.user.wallet.addresses = [];
    this.seedConfirmed = false;
    this.networkService.updateUser(this.user);
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
    this.user.wallet.seedPassphrase = this.seedPassphrase || '';
    this.user.wallet.step = 'set-passphrase';

    try {
      const mnemonic = this.user.wallet.seed.join(' ');
      const seedBytes = mnemonicToSeedSync(
        mnemonic,
        this.user.wallet.seedPassphrase
      );
      const seed = bytesToHex(seedBytes);

      this.user.wallet.addresses = this.keyService.deriveBitcoinAddresses(
        seed,
        1
      );
      this.networkService.updateUser(this.user);
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
    this.networkService.updateUser(this.user);
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
    if (!this.showingKeys[index]) return;
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
  changeAddressType(type: 'bip44' | 'bip49' | 'bip84'): void {
    this.selectedAddressType = type;
  }

  rowTrackBy(index: number, item: BitcoinAddress): string {
    return item.bip44.keys.priv;
  }
}
