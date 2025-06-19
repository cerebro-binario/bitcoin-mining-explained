import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mnemonicToSeedSync } from '@scure/bip39';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { KeyService } from '../../../services/key.service';
import { bytesToHex } from '../../../utils/tools';
import { WalletComponent } from '../../network/wallet/wallet.component';
import { Node } from '../../../models/node';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    WalletComponent,
  ],
  templateUrl: './user-profile.component.html',
})
export class UserProfileComponent implements OnInit {
  user!: Node;
  @ViewChild('inputSeedPassphrase')
  inputSeedPassphrase?: ElementRef<HTMLInputElement>;
  @ViewChild('inputWalletPassphrase')
  inputWalletPassphrase?: ElementRef<HTMLInputElement>;

  passphrase = '';
  passphraseConfirm = '';
  passphraseError = '';

  seedPassphrase = '';
  seedPassphraseError = '';

  copiedSeed = false;
  seedConfirmed = false;

  importSeed = '';
  importSeedPassphrase = '';
  importSeedError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private networkService: BitcoinNetworkService,
    public keyService: KeyService
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const userId = parseInt(params['id']);
      this.user = this.networkService.nodes.find(
        (n) => n.id === userId && n.nodeType === 'user'
      ) as Node;

      if (!this.user) {
        this.router.navigate(['/']);
      }
    });
  }

  deriveNextAddress() {
    if (!this.user.wallet) return;

    const newAddress = this.keyService.deriveNextBitcoinAddress(
      this.user.wallet
    );

    if (newAddress) {
      const newWallet = { ...this.user.wallet };
      newWallet.addresses = [...newWallet.addresses, newAddress];
      this.user.wallet = newWallet;
    }
  }

  createWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'show-seed';
    this.user.wallet.seed = this.keyService.generateSeed();
    this.user.wallet.seedPassphrase = '';
    this.user.wallet.addresses = [];
    this.seedConfirmed = false;
  }

  importWallet() {
    if (!this.user.wallet) return;
    this.user.wallet.step = 'confirm-seed';
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
}
