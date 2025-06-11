import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  private _pagination: {
    pageSize: number;
    currentPage: bigint;
    totalPages: bigint;
  } | null = null;

  @Input() addresses!: BitcoinAddress[];
  @Input() addressType: 'bip44' | 'bip49' | 'bip84' = 'bip84';
  @Input() set pagination(
    value: {
      pageSize: number;
      currentPage: bigint;
      totalPages: bigint;
    } | null
  ) {
    this._pagination = value;
  }

  get first() {
    if (!this._pagination) return 0;
    return Number(
      this._pagination.currentPage * BigInt(this._pagination.pageSize)
    );
  }

  rowTrackBy(index: number, item: BitcoinAddress): string {
    return item.bip84.keys.priv.hex;
  }

  copyToClipboard(text: string | undefined): void {
    copyToClipboard(text);
  }

  changeAddressType(type: 'bip44' | 'bip49' | 'bip84'): void {
    this.addressType = type;
  }
}
