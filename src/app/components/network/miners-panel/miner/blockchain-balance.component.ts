import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Node } from '../../../../models/node';
import {
  BipType,
  BitcoinAddressData,
  TOTAL_PRIVATE_KEY_RECORDS,
} from '../../../../models/wallet.model';
import { KeyService } from '../../../../services/key.service';
import { AddressListComponent } from '../../wallet/address-list/address-list.component';
import { ceilBigInt } from '../../../../utils/tools';
import { PaginationBarComponent } from '../../wallet/pagination-bar.component';

@Component({
  selector: 'app-blockchain-balance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    AddressListComponent,
    PaginationBarComponent,
  ],
  templateUrl: './blockchain-balance.component.html',
  styleUrls: ['./blockchain-balance.component.scss'],
})
export class BlockchainBalanceComponent implements OnInit {
  @Input() node!: Node;

  addresses: BitcoinAddressData[] = [];
  addressesDisplay: BitcoinAddressData[] = [];

  displayMode: 'all-private-keys' | 'with-balance' = 'with-balance';
  displayModeOptions = [
    { label: 'Mostrar todos', value: 'all-private-keys' },
    { label: 'Apenas com saldo', value: 'with-balance' },
  ];
  addressType: BipType | 'all-bip-types' = 'bip84';

  pagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  jumpPageInput: string = '';

  sortField: 'saldo' | null = null;
  sortOrder: number = 0;

  constructor(private keyService: KeyService) {}

  ngOnInit() {
    this.node.balances$.subscribe(() => {
      this.updateView();
    });
    this.updateView();
  }

  private updateView() {
    this.updateAddresses();
    this.updateTotalPages();
    this.displayAddresses();
  }

  private updateAddresses() {
    if (this.displayMode === 'with-balance') {
      this.mapBalancesToAddresses();
    } else {
      this.mapSequentialAddresses();
    }
  }

  private mapBalancesToAddresses() {
    this.addresses = [];
    const entries = Object.entries(this.node.balances);
    this.addresses = entries.reduce((acc, [address, balance]) => {
      if (!balance) return acc;
      if (
        this.addressType === 'all-bip-types' ||
        balance.addressType === this.addressType
      ) {
        acc.push(balance);
      }
      return acc;
    }, [] as BitcoinAddressData[]);
  }

  private mapSequentialAddresses() {
    const { currentPage, pageSize } = this.pagination;
    const offset = currentPage * BigInt(pageSize);
    let start =
      this.addressType === 'all-bip-types' ? offset / 3n + 1n : offset + 1n;
    const addresses =
      this.keyService.deriveBitcoinAddressesFromSequentialPrivateKey(
        this.pagination.pageSize,
        start
      );
    if (this.addressType === 'all-bip-types') {
      const skip = Number(offset % 3n);
      this.addresses = addresses
        .reduce((acc, address) => {
          if (acc.length >= this.pagination.pageSize + skip) return acc;
          const values = Object.values(address);
          return [...acc, ...values];
        }, [] as BitcoinAddressData[])
        .slice(skip, this.pagination.pageSize + skip);
    } else {
      this.addresses = addresses.map(
        (address) => address[this.addressType as BipType]
      );
    }
  }

  private displayAddresses() {
    const start =
      Number(this.pagination.currentPage) * Number(this.pagination.pageSize);
    const end = start + Number(this.pagination.pageSize);
    const addressDisplay =
      this.displayMode === 'all-private-keys'
        ? this.addresses.slice(0, this.pagination.pageSize)
        : this.addresses.slice(start, end);
    this.addressesDisplay = addressDisplay.map(this.identifyAddress);
  }

  updateTotalPages() {
    if (this.displayMode === 'all-private-keys') {
      const totalRecords =
        this.addressType === 'all-bip-types'
          ? TOTAL_PRIVATE_KEY_RECORDS * 3n
          : TOTAL_PRIVATE_KEY_RECORDS;
      this.pagination = {
        ...this.pagination,
        totalPages: ceilBigInt(
          BigInt(totalRecords),
          BigInt(this.pagination.pageSize)
        ),
      };
    } else {
      const totalRecords = BigInt(this.addresses.length);
      this.pagination = {
        ...this.pagination,
        totalPages: ceilBigInt(
          BigInt(totalRecords),
          BigInt(this.pagination.pageSize)
        ),
      };
    }
  }

  onDisplayModeChange() {
    this.pagination.currentPage = 0n;
    this.updateView();
  }

  onChangeAddressType(addressType: BipType | 'all-bip-types') {
    this.addressType = addressType;
    this.updateView();
  }

  identifyAddress = (addressRef: BitcoinAddressData) => {
    const { address } = addressRef;
    const addressData =
      this.node.balances[address] || this.findAddressInWallet(address);
    return addressData || addressRef;
  };

  findAddressInWallet(address: string): BitcoinAddressData | undefined {
    for (const addressGroup of this.node.wallet.addresses) {
      if (addressGroup.bip44.address === address) {
        return addressGroup.bip44;
      }
      if (addressGroup.bip49.address === address) {
        return addressGroup.bip49;
      }
      if (addressGroup.bip84.address === address) {
        return addressGroup.bip84;
      }
    }
    return undefined;
  }

  goToFirstPage() {
    this.pagination.currentPage = 0n;
    this.updateView();
  }

  goToPreviousPage() {
    if (this.pagination.currentPage > 0n) {
      this.pagination.currentPage--;
      this.updateView();
    }
  }

  goToNextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages - 1n) {
      this.pagination.currentPage++;
      this.updateView();
    }
  }

  goToLastPage() {
    this.pagination.currentPage = this.pagination.totalPages - 1n;
    this.updateView();
  }

  goToRandomPage() {
    const randomPage = BigInt(
      Math.floor(Math.random() * Number(this.pagination.totalPages))
    );
    this.pagination.currentPage = randomPage;
    this.updateView();
  }

  jumpToPage(pageInt: number) {
    const page = Number(pageInt);
    if (
      !isNaN(page) &&
      page > 0 &&
      page <= Number(this.pagination.totalPages)
    ) {
      this.pagination.currentPage = BigInt(page - 1);
      this.updateView();
    }
    this.jumpPageInput = '';
  }

  get currentPageDisplay(): number {
    return Number(this.pagination.currentPage) + 1;
  }

  get totalPagesDisplay(): number {
    return Number(this.pagination.totalPages);
  }

  get pagePercent(): number {
    if (this.pagination.totalPages === 0n) return 0;
    return (
      ((Number(this.pagination.currentPage) + 1) /
        Number(this.pagination.totalPages)) *
      100
    );
  }

  get prevDisabled(): boolean {
    return this.pagination.currentPage === 0n;
  }

  get nextDisabled(): boolean {
    return (
      this.pagination.currentPage >= this.pagination.totalPages - 1n ||
      this.pagination.totalPages === 0n
    );
  }
}
