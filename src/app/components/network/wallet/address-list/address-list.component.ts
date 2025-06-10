import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BitcoinAddress } from '../../../../models/wallet.model';
import { copyToClipboard } from '../../../../utils/tools';

@Component({
  selector: 'app-address-list',
  templateUrl: './address-list.component.html',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule],
})
export class AddressListComponent {
  @Input() addresses!: BitcoinAddress[];
  @Input() addressType: 'bip44' | 'bip49' | 'bip84' = 'bip84';
  @Input() keysFormat: 'wif' | 'hex' | 'decimal' = 'hex';

  rowTrackBy(index: number, item: BitcoinAddress): string {
    return item.bip84.keys.priv.hex;
  }

  copyToClipboard(text: string | undefined): void {
    copyToClipboard(text);
  }
}
