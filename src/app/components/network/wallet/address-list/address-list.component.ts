import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BipType, BitcoinAddressData } from '../../../../models/wallet.model';
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

  @Input() addresses: BitcoinAddressData[] = [];
  @Input() addressType: BipType | 'all-bip-types' = 'bip84';
  @Input() nodeId: number | null = null;
  @Input() hideTitle = false;

  @Input() set pagination(
    value: {
      pageSize: number;
      currentPage: bigint;
      totalPages: bigint;
    } | null
  ) {
    this._pagination = value;
  }

  @Input() canDeriveNextAddress = false;
  @Output() deriveNextAddress = new EventEmitter<void>();
  @Output() changeAddressType = new EventEmitter<BipType | 'all-bip-types'>();

  get first() {
    if (!this._pagination) return 0;
    return Number(
      this._pagination.currentPage * BigInt(this._pagination.pageSize)
    );
  }

  rowTrackBy(index: number, item: BitcoinAddressData): string {
    return item.address;
  }

  copyToClipboard(text: string | undefined): void {
    copyToClipboard(text);
  }

  onAddressTypeChange(type: BipType | 'all-bip-types') {
    this.addressType = type;
    this.changeAddressType.emit(type);
  }
}
