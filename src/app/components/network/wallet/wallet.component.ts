import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { BitcoinAddress, Wallet } from '../../../models/wallet.model';
import { AddressListComponent } from './address-list/address-list.component';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    FormsModule,
    AddressListComponent,
  ],
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  private _wallet: Wallet | null = null;
  private goToLastPageAfterWalletUpdate = false;

  @Input() set wallet(wallet: Wallet | null) {
    if (this._wallet === wallet) return;
    this._wallet = wallet;
    this.updateTotalPages();
    this.loadAddresses();
    if (this.goToLastPageAfterWalletUpdate) {
      this.goToLastPage();
      this.goToLastPageAfterWalletUpdate = false;
    }
  }
  @Output() deriveNextAddress = new EventEmitter<void>();

  displayedAddresses: BitcoinAddress[] = [];

  pagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  jumpPageInput: string = '';

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
    return this.pagination.currentPage >= this.pagination.totalPages - 1n;
  }

  updateTotalPages() {
    if (!this._wallet) return;
    this.pagination.totalPages = BigInt(
      Math.ceil(this._wallet.addresses.length / this.pagination.pageSize)
    );
    this.pagination.currentPage = 0n;
  }

  goToFirstPage() {
    this.pagination.currentPage = 0n;
    this.loadAddresses();
  }
  goToPreviousPage() {
    if (this.pagination.currentPage > 0n) {
      this.pagination.currentPage--;
      this.loadAddresses();
    }
  }
  goToNextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages - 1n) {
      this.pagination.currentPage++;
      this.loadAddresses();
    }
  }
  goToLastPage() {
    this.pagination.currentPage = this.pagination.totalPages - 1n;
    this.loadAddresses();
  }
  goToRandomPage() {
    const rand = BigInt(
      Math.floor(Math.random() * Number(this.pagination.totalPages))
    );
    this.pagination.currentPage = rand;
    this.loadAddresses();
  }
  jumpToPage() {
    try {
      let page = BigInt(this.jumpPageInput);
      if (page < 1n) page = 1n;
      if (page > this.pagination.totalPages) page = this.pagination.totalPages;
      this.pagination.currentPage = page - 1n;
      this.loadAddresses();
    } catch {
      // ignore invalid input
    }
  }

  loadAddresses() {
    if (!this._wallet) return;
    this.displayedAddresses = this._wallet.addresses.slice(
      Number(this.pagination.currentPage) * Number(this.pagination.pageSize),
      (Number(this.pagination.currentPage) + 1) *
        Number(this.pagination.pageSize)
    );
  }

  onDeriveNextAddress() {
    this.deriveNextAddress.emit();
    this.goToLastPageAfterWalletUpdate = true;
  }
}
