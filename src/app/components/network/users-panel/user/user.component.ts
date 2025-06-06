import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mnemonicToSeedSync } from '@scure/bip39';
import { Keys } from '../../../../models/node';
import { User } from '../../../../models/user.model';
import { KeyService } from '../../../../services/key.service';
import { bytesToHex } from '../../../../utils/tools';

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
  selectedAddressType: 'bip44' | 'bip49' | 'bip84' = 'bip84';

  constructor(public keyService: KeyService) {}

  get wallet() {
    return this.user.wallet;
  }

  get addresses(): string[] {
    return (
      this.user.wallet?.addresses?.[this.selectedAddressType]?.map(
        (addr) => addr.address
      ) || []
    );
  }

  deriveNextAddress() {
    if (!this.user.wallet?.seed?.length) return;

    const mnemonic = this.user.wallet.seed.join(' ');
    const passphrase = this.user.wallet.seedPassphrase || '';
    const currentCount =
      this.user.wallet?.addresses?.[this.selectedAddressType]?.length || 0;

    try {
      // Converte mnemônico para seed usando PBKDF2
      const seedBytes = mnemonicToSeedSync(mnemonic, passphrase);
      const seed = bytesToHex(seedBytes);

      // Deriva as chaves para cada tipo de endereço usando seus respectivos BIPs
      const legacyKeys = this.keyService.deriveKeysFromSeed(
        seed,
        1,
        'bip44',
        currentCount
      );
      const segwitKeys = this.keyService.deriveKeysFromSeed(
        seed,
        1,
        'bip49',
        currentCount
      );
      const nativeSegwitKeys = this.keyService.deriveKeysFromSeed(
        seed,
        1,
        'bip84',
        currentCount
      );

      // Gera o endereço com todos os formatos usando as chaves corretas
      const newBip44Addresses = [
        {
          privateKey: legacyKeys[0].priv,
          publicKey: legacyKeys[0].pub,
          path: legacyKeys[0].path || `m/44'/0'/0'/0/${currentCount}`,
          address: this.keyService.generateBitcoinAddress(
            legacyKeys[0].pub,
            'bip44'
          ),
        },
      ];
      const newBip49Addresses = [
        {
          privateKey: segwitKeys[0].priv,
          publicKey: segwitKeys[0].pub,
          path: segwitKeys[0].path || `m/49'/0'/0'/0/${currentCount}`,
          address: this.keyService.generateBitcoinAddress(
            segwitKeys[0].pub,
            'bip49'
          ),
        },
      ];
      const newBip84Addresses = [
        {
          privateKey: nativeSegwitKeys[0].priv, // Usamos a chave do BIP84 como principal
          publicKey: nativeSegwitKeys[0].pub,
          path: nativeSegwitKeys[0].path || `m/84'/0'/0'/0/${currentCount}`, // Garante que path sempre existe
          address: this.keyService.generateBitcoinAddress(
            nativeSegwitKeys[0].pub,
            'bip84'
          ),
        },
      ];

      // Adiciona o novo endereço à lista
      this.user.wallet.addresses = {
        bip44: [
          ...(this.user.wallet.addresses.bip44 || []),
          ...newBip44Addresses,
        ],
        bip49: [
          ...(this.user.wallet.addresses.bip49 || []),
          ...newBip49Addresses,
        ],
        bip84: [
          ...(this.user.wallet.addresses.bip84 || []),
          ...newBip84Addresses,
        ],
      };
    } catch (error) {
      console.error('Erro ao gerar novo endereço:', error);
    }
  }

  createWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'show-seed';
    this.user.wallet.seed = this.keyService.generateSeed().split(' ');
    this.user.wallet.seedPassphrase = '';
    this.user.wallet.addresses = {
      bip44: [],
      bip49: [],
      bip84: [],
    };
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
      const seed = bytesToHex(seedBytes);

      // Deriva a primeira chave usando BIP44, BIP49 e BIP84
      const bip84Keys = this.keyService.deriveKeysFromSeed(seed, 1, 'bip84');
      const bip44Keys = this.keyService.deriveKeysFromSeed(seed, 1, 'bip44');
      const bip49Keys = this.keyService.deriveKeysFromSeed(seed, 1, 'bip49');

      this.user.wallet.addresses = {
        bip44: bip44Keys.map((key) => ({
          privateKey: key.priv,
          publicKey: key.pub,
          path: key.path || '',
          address: this.keyService.generateBitcoinAddress(key.pub, 'bip44'),
        })),
        bip49: bip49Keys.map((key) => ({
          privateKey: key.priv,
          publicKey: key.pub,
          path: key.path || '',
          address: this.keyService.generateBitcoinAddress(key.pub, 'bip49'),
        })),
        bip84: bip84Keys.map((key) => ({
          privateKey: key.priv,
          publicKey: key.pub,
          path: key.path || '',
          address: this.keyService.generateBitcoinAddress(key.pub, 'bip84'),
        })),
      };
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
    if (
      !this.user.wallet?.addresses?.[this.selectedAddressType]?.[index] ||
      !this.showingKeys[index]
    )
      return;
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
}
