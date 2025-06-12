import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import {
  BipType,
  BitcoinAddressData,
  Wallet,
} from '../../../models/wallet.model';
import { AddressListComponent } from './address-list/address-list.component';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { Transaction } from '../../../models/block.model';

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
    TabsModule,
    TransactionListComponent,
  ],
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  private _wallet: Wallet | null = null;
  private goToLastPageAfterWalletUpdate = false;

  activeTab: 'enderecos' | 'transacoes' | 'enviar' = 'enderecos';

  @Input() set wallet(wallet: Wallet | null) {
    if (this._wallet === wallet) return;
    this._wallet = wallet;
    this.updateView();
    if (this.goToLastPageAfterWalletUpdate) {
      this.goToLastPage();
      this.goToLastPageAfterWalletUpdate = false;
    }
  }
  @Output() deriveNextAddress = new EventEmitter<void>();

  addresses: BitcoinAddressData[] = [];
  addressesDisplay: BitcoinAddressData[] = [];
  addressType: BipType | 'all-bip-types' = 'bip84';
  pagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  jumpPageInput: string = '';
  transactions: Transaction[] = [];
  availableBalance = 0;

  // Campos do formulário de envio
  sendToAddress: string = '';
  sendAmount: number | null = null;
  sendError: string = '';
  sendSuccess: string = '';

  // Controle de erro e foco do campo de valor
  sendAmountTouched = false;
  sendAmountFocused = false;
  get sendAmountInsuficiente(): boolean {
    return (
      typeof this.sendAmount === 'number' &&
      this.sendAmount > this.availableBalance
    );
  }
  get sendButtonDisabled(): boolean {
    return (
      !this.sendToAddress ||
      !this.sendAmount ||
      this.sendAmount <= 0 ||
      this.sendAmountInsuficiente
    );
  }

  private updateView() {
    this.updateAddresses();
    this.updateTotalPages();
    this.displayAddresses();
    this.updateAvailableBalance();
  }

  private updateAddresses() {
    if (!this._wallet) return;
    this.addresses = [];

    if (this.addressType === 'all-bip-types') {
      this.addresses = this._wallet.addresses.reduce((acc, address) => {
        return [...acc, ...Object.values(address)];
      }, [] as BitcoinAddressData[]);
    } else {
      this.addresses = this._wallet.addresses.map(
        (address) => address[this.addressType as BipType]
      );
    }
  }

  private displayAddresses() {
    const start =
      Number(this.pagination.currentPage) * Number(this.pagination.pageSize);
    const end = start + Number(this.pagination.pageSize);

    this.addressesDisplay = this.addresses.slice(start, end);
  }

  onDeriveNextAddress() {
    this.deriveNextAddress.emit();
    this.goToLastPageAfterWalletUpdate = true;
  }

  onChangeAddressType(type: BipType | 'all-bip-types') {
    this.addressType = type;
    this.updateView();
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
    const rand = BigInt(
      Math.floor(Math.random() * Number(this.pagination.totalPages))
    );
    this.pagination.currentPage = rand;
    this.updateView();
  }
  jumpToPage() {
    try {
      let page = BigInt(this.jumpPageInput);
      if (page < 1n) page = 1n;
      if (page > this.pagination.totalPages) page = this.pagination.totalPages;
      this.pagination.currentPage = page - 1n;
      this.updateView();
    } catch {
      // ignore invalid input
    }
  }

  private updateAvailableBalance() {
    if (!this._wallet) {
      this.availableBalance = 0;
      return;
    }
    // Soma o saldo de todos os endereços (todas as BIP types)
    this.availableBalance = this._wallet.addresses
      .flatMap((addrObj) => Object.values(addrObj))
      .reduce((sum, addr) => sum + (addr.balance || 0), 0);
  }

  onSendTransaction(event: Event) {
    event.preventDefault();
    this.sendError = '';
    this.sendSuccess = '';
    // Validação básica
    if (!this.sendToAddress || this.sendToAddress.length < 10) {
      this.sendError = 'Endereço de destino inválido.';
      return;
    }
    if (!this.sendAmount || this.sendAmount <= 0) {
      this.sendError = 'Informe um valor válido.';
      return;
    }
    if (this.sendAmountInsuficiente) {
      // Não mostra erro geral, só impede envio
      return;
    }
    // Criar transação fake
    const tx: Transaction = {
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      inputs: [], // Para simulação, pode ser vazio
      outputs: [],
      signature: 'simulated',
    };
    this.transactions = [tx, ...this.transactions];
    this.availableBalance -= this.sendAmount;
    this.sendSuccess = 'Transação enviada!';
    // Limpar campos (opcional)
    this.sendToAddress = '';
    this.sendAmount = null;
    this.sendAmountTouched = false;
    this.sendAmountFocused = false;
    // Atualizar view
    this.updateView();
  }
}
