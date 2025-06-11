import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import {
  BipType,
  BitcoinAddress,
  BitcoinAddressData,
} from '../../../../models/wallet.model';
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

  private _addresses: BitcoinAddress[] = [];
  private _onlyWithBalance = false;
  displayedAddresses: BitcoinAddressData[] = [];

  @Input() set addresses(value: BitcoinAddress[]) {
    if (value === this._addresses) return;
    this._addresses = value;
    this.displayedAddresses = [];
    this.updateDisplayedAddresses();
  }

  @Input() addressType: BipType | 'all' = 'bip84';
  @Input() nodeId: number | null = null;

  @Input() set pagination(
    value: {
      pageSize: number;
      currentPage: bigint;
      totalPages: bigint;
    } | null
  ) {
    this._pagination = value;
  }

  @Input() set onlyWithBalance(value: boolean) {
    if (value === this._onlyWithBalance) return;
    this._onlyWithBalance = value;
    this.updateDisplayedAddresses();
  }

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

  changeAddressType(type: BipType | 'all'): void {
    this.addressType = type;
    this.updateDisplayedAddresses();
  }

  updateDisplayedAddresses(): void {
    if (this.addressType === 'all') {
      this.displayedAddresses = this._addresses.reduce((acc, address) => {
        return [
          ...acc,
          ...Object.values(address).filter((address) =>
            this._onlyWithBalance ? address.balance > 0 : true
          ),
        ];
      }, [] as BitcoinAddressData[]);
    } else {
      this.displayedAddresses = this._addresses.map(
        (address) => address[this.addressType as BipType]
      );
    }
  }
}
