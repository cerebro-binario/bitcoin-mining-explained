import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PaginatorModule } from 'primeng/paginator';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Subscription } from 'rxjs';
import { Node } from '../../../../../models/node';
import {
  BitcoinAddress,
  TOTAL_PRIVATE_KEY_RECORDS,
} from '../../../../../models/wallet.model';
import { KeyService } from '../../../../../services/key.service';
import { AddressListComponent } from '../../../wallet/address-list/address-list.component';

@Component({
  selector: 'app-balance-dialog',
  templateUrl: './balance-dialog.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    TableModule,
    ButtonModule,
    SelectButtonModule,
    PaginatorModule,
    AddressListComponent,
  ],
})
export class BalanceDialogComponent implements OnInit, OnDestroy {
  @Input() node!: Node;
  @Output() close = new EventEmitter<void>();

  displayMode: 'all' | 'with-balance' = 'with-balance';
  addresses: BitcoinAddress[] = [];

  displayModeOptions = [
    { label: 'Mostrar todos', value: 'all' },
    { label: 'Apenas com saldo', value: 'with-balance' },
  ];

  private balancesSub?: Subscription;

  // Paginator customizado
  pagination = {
    pageSize: 10,
    currentPage: 0n,
    totalPages: 0n,
  };
  jumpPageInput: string = '';

  sortField: 'saldo' | null = null;
  sortOrder: number = 0;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private keyService: KeyService
  ) {}

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

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
    this.updateTotalPages();
    this.loadAddresses();
    this.balancesSub = this.node.balances$.subscribe(() => {
      this.loadAddresses();
    });
  }

  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
    this.balancesSub?.unsubscribe();
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  updateTotalPages() {
    if (this.displayMode === 'all') {
      // Valor máximo do grupo secp256k1
      const totalRecords = TOTAL_PRIVATE_KEY_RECORDS;
      this.pagination.totalPages =
        (totalRecords + BigInt(this.pagination.pageSize) - 1n) /
        BigInt(this.pagination.pageSize);
    } else {
      const totalRecords = BigInt(this.addresses.length);
      this.pagination.totalPages =
        (totalRecords + BigInt(this.pagination.pageSize) - 1n) /
        BigInt(this.pagination.pageSize);
    }
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
  formatBigInt(n: bigint): string {
    if (n < 1_000_000_000_000_000n) return n.toString();
    // Notação científica para números grandes
    const exp = n.toString().length - 1;
    const mantissa = n.toString().slice(0, 4);
    return `${mantissa[0]}.${mantissa.slice(1)} × 10^${exp}`;
  }

  onSort(field: string) {
    if (field !== 'saldo') return;
    if (this.sortField === 'saldo') {
      this.sortOrder = this.sortOrder === 1 ? -1 : 1;
    } else {
      this.sortField = 'saldo';
      this.sortOrder = 1;
    }
    this.loadAddresses();
  }

  clearSort() {
    this.sortField = null;
    this.sortOrder = 0;
    this.loadAddresses();
  }

  loadAddresses() {
    if (this.displayMode === 'with-balance') {
      this.addresses = [];
      for (const [address, data] of Object.entries(this.node.balances)) {
        if (!data || !data.balance || data.balance === 0) continue;
        let addressType: 'bip44' | 'bip49' | 'bip84' = 'bip44';
        if (address.startsWith('3')) addressType = 'bip49';
        else if (address.startsWith('bc1')) addressType = 'bip84';
        const addressRow: BitcoinAddress = {
          bip44: {
            address: '',
            balance: 0,
            utxos: [],
            keys: {
              priv: { hex: '', decimal: '', wif: '' },
              pub: { hex: '', decimal: '' },
            },
            addressType: 'bip44',
            nodeId: data.nodeId,
          },
          bip49: {
            address: '',
            balance: 0,
            utxos: [],
            keys: {
              priv: { hex: '', decimal: '', wif: '' },
              pub: { hex: '', decimal: '' },
            },
            addressType: 'bip49',
            nodeId: data.nodeId,
          },
          bip84: {
            address: '',
            balance: 0,
            utxos: [],
            keys: {
              priv: { hex: '', decimal: '', wif: '' },
              pub: { hex: '', decimal: '' },
            },
            addressType: 'bip84',
            nodeId: data.nodeId,
          },
        };
        addressRow[addressType] = {
          address,
          balance: data.balance,
          utxos: data.utxos,
          keys: data.keys,
          addressType,
          nodeId: data.nodeId,
        };
        this.addresses.push(addressRow);
      }
      // Ordenação para with-balance
      if (this.sortField === 'saldo') {
        this.addresses.sort((a, b) => {
          const saldoA = a.bip44.balance + a.bip49.balance + a.bip84.balance;
          const saldoB = b.bip44.balance + b.bip49.balance + b.bip84.balance;
          return this.sortOrder === 1 ? saldoA - saldoB : saldoB - saldoA;
        });
      }
      const totalRecords = BigInt(this.addresses.length);
      this.pagination.totalPages =
        (totalRecords + BigInt(this.pagination.pageSize) - 1n) /
        BigInt(this.pagination.pageSize);
    } else {
      // Modo 'all'
      const pageSize = BigInt(this.pagination.pageSize);
      const start = this.pagination.currentPage * pageSize + 1n;
      this.addresses = [];
      const addresses =
        this.keyService.deriveBitcoinAddressesFromSequentialPrivateKey(
          Number(pageSize),
          start
        );
      for (const address of addresses) {
        const priv = address.bip44.keys.priv;
        const bip44 = address.bip44.address;
        const bip49 = address.bip49.address;
        const bip84 = address.bip84.address;
        const bip44Data = this.node.balances[bip44];
        const bip49Data = this.node.balances[bip49];
        const bip84Data = this.node.balances[bip84];
        this.addresses.push({
          bip44: {
            address: bip44,
            balance: bip44Data?.balance || 0,
            utxos: bip44Data?.utxos || [],
            keys: address.bip44.keys,
            addressType: 'bip44',
            nodeId: bip44Data?.nodeId || 0,
          },
          bip49: {
            address: bip49,
            balance: bip49Data?.balance || 0,
            utxos: bip49Data?.utxos || [],
            keys: address.bip49.keys,
            addressType: 'bip49',
            nodeId: bip49Data?.nodeId || 0,
          },
          bip84: {
            address: bip84,
            balance: bip84Data?.balance || 0,
            utxos: bip84Data?.utxos || [],
            keys: address.bip84.keys,
            addressType: 'bip84',
            nodeId: bip84Data?.nodeId || 0,
          },
        });
      }

      this.updateTotalPages();
    }
  }

  onDisplayModeChange() {
    this.loadAddresses();
  }
}
