import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BipType, BitcoinAddressData } from '../../../../models/wallet.model';
import { copyToClipboard } from '../../../../utils/tools';
import { PaginationBarComponent } from '../pagination-bar.component';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-address-list',
  templateUrl: './address-list.component.html',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    PaginationBarComponent,
    RouterLink,
  ],
})
export class AddressListComponent {
  private _pagination: {
    pageSize: number;
    currentPage: bigint;
    totalPages: bigint;
  } | null = null;

  @Input() addresses: BitcoinAddressData[] = [];
  @Input() bipFormat: BipType | 'all-bip-types' = 'bip84';
  @Input() nodeId: number | null = null;
  @Input() hideTitle = false;
  @Input() showPrivateKey = false;

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
  @Output() bipFormatChange = new EventEmitter<BipType | 'all-bip-types'>();

  utxoPagination: {
    [address: string]: { currentPage: number; pageSize: number };
  } = {};

  constructor(private router: Router) {}

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

  onBipFormatChange(type: BipType | 'all-bip-types') {
    this.bipFormat = type;
    this.bipFormatChange.emit(type);
  }

  getUtxosPage(address: string, utxos: any[]) {
    const pageSize = this.utxoPagination[address]?.pageSize || 10;
    const currentPage = this.utxoPagination[address]?.currentPage || 1;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return utxos.slice(start, end);
  }

  getUtxoTotalPages(address: string, utxos: any[]): bigint {
    const pageSize = this.utxoPagination[address]?.pageSize || 10;
    return BigInt(Math.ceil(utxos.length / pageSize) || 1);
  }

  goToUtxoPage(address: string, page: bigint, utxos: any[]) {
    const totalPages = Number(this.getUtxoTotalPages(address, utxos));
    const pageNumber = Number(page);
    this.utxoPagination[address] = {
      currentPage: Math.max(1, Math.min(pageNumber, totalPages)),
      pageSize: this.utxoPagination[address]?.pageSize || 10,
    };
  }

  // Métodos auxiliares para o template
  toNumber(value: bigint): number {
    return Number(value);
  }

  toBigInt(value: number): bigint {
    return BigInt(value);
  }

  getFirstPage(): bigint {
    return 1n;
  }

  openAddressDetails(addressData: BitcoinAddressData) {
    if (this.nodeId) {
      this.router.navigate([
        '/miner',
        this.nodeId,
        'addresses',
        addressData.address,
        {
          queryParams: {
            pk: addressData.keys?.priv?.hex,
          },
        },
      ]);
    }
  }
}
