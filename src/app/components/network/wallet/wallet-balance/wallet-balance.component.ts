import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BitcoinAddress, Keys, Wallet } from '../../../../models/wallet.model';
import { copyToClipboard, hexToWif } from '../../../../utils/tools';

@Component({
  selector: 'app-wallet-balance',
  templateUrl: './wallet-balance.component.html',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule],
})
export class WalletBalanceComponent {
  @Input() wallet!: Wallet;
  @Input() addressType: 'bip44' | 'bip49' | 'bip84' = 'bip84';
  @Input() keysFormat: 'wif' | 'hex' | 'decimal' = 'hex';

  rowTrackBy(index: number, item: BitcoinAddress): string {
    return item.bip84.keys.priv;
  }

  copyToClipboard(text: string | undefined): void {
    copyToClipboard(text);
  }

  getPrivKeyDisplay(keys: Keys): string {
    if (this.keysFormat === 'hex') {
      return '0x' + keys.priv;
    } else if (this.keysFormat === 'decimal') {
      // decimal
      try {
        return BigInt(keys.priv).toString(10);
      } catch {
        return '(inválido)';
      }
    } else if (this.keysFormat === 'wif') {
      return hexToWif(keys.priv);
    }

    return '(inválido)';
  }

  getPubKeyDisplay(keys: Keys): string {
    if (this.keysFormat === 'hex' || this.keysFormat === 'wif') {
      return '0x' + keys.pub;
    } else if (this.keysFormat === 'decimal') {
      // decimal
      try {
        return BigInt('0x' + keys.pub).toString(10);
      } catch {
        return '(inválido)';
      }
    }

    return '(inválido)';
  }
}
