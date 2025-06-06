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
import { Keys, Node } from '../../../../../models/node';
import { KeyService } from '../../../../../services/key.service';

interface AddressRow {
  id: string;
  keys: Keys;
  bip44: { address: string; balance: number; utxos: any[] };
  bip49: { address: string; balance: number; utxos: any[] };
  bip84: { address: string; balance: number; utxos: any[] };
  isMine?: boolean;
}

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
  ],
})
export class BalanceDialogComponent implements OnInit, OnDestroy {
  @Input() node!: Node;
  @Output() close = new EventEmitter<void>();

  displayMode: 'all' | 'with-balance' = 'with-balance';
  first = 0;
  rows = 10;
  totalRecords: bigint = 0n;
  addresses: AddressRow[] = [];

  displayModeOptions = [
    { label: 'Mostrar todos', value: 'all' },
    { label: 'Apenas com saldo', value: 'with-balance' },
  ];

  keyFormat: 'hex' | 'dec' = 'hex';
  keyFormatOptions = [
    { label: 'Hexadecimal', value: 'hex' },
    { label: 'Decimal', value: 'dec' },
  ];

  private balancesSub?: Subscription;

  // Paginator customizado
  pageSize = 10;
  currentPage: bigint = 0n;
  totalPages: bigint = 0n;
  jumpPageInput: string = '';

  sortField: 'saldo' | null = null;
  sortOrder: number = 0;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private keyService: KeyService
  ) {}

  get currentPageDisplay(): number {
    return Number(this.currentPage) + 1;
  }
  get totalPagesDisplay(): number {
    return Number(this.totalPages);
  }
  get pagePercent(): number {
    if (this.totalPages === 0n) return 0;
    return ((Number(this.currentPage) + 1) / Number(this.totalPages)) * 100;
  }
  get prevDisabled(): boolean {
    return this.currentPage === 0n;
  }
  get nextDisabled(): boolean {
    return this.currentPage >= this.totalPages - 1n;
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

  rowTrackBy(index: number, item: AddressRow): string {
    return item.id;
  }

  updateTotalPages() {
    if (this.displayMode === 'all') {
      // Valor máximo do grupo secp256k1
      const N = BigInt(
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
      );
      this.totalRecords = N - 1n;
      this.totalPages =
        (this.totalRecords + BigInt(this.pageSize) - 1n) /
        BigInt(this.pageSize);
    } else {
      this.totalRecords = BigInt(this.addresses.length);
      this.totalPages =
        (this.totalRecords + BigInt(this.pageSize) - 1n) /
        BigInt(this.pageSize);
    }
  }

  goToFirstPage() {
    this.currentPage = 0n;
    this.loadAddresses();
  }
  goToPreviousPage() {
    if (this.currentPage > 0n) {
      this.currentPage--;
      this.loadAddresses();
    }
  }
  goToNextPage() {
    if (this.currentPage < this.totalPages - 1n) {
      this.currentPage++;
      this.loadAddresses();
    }
  }
  goToLastPage() {
    this.currentPage = this.totalPages - 1n;
    this.loadAddresses();
  }
  goToRandomPage() {
    const rand = BigInt(Math.floor(Math.random() * Number(this.totalPages)));
    this.currentPage = rand;
    this.loadAddresses();
  }
  jumpToPage() {
    try {
      let page = BigInt(this.jumpPageInput);
      if (page < 1n) page = 1n;
      if (page > this.totalPages) page = this.totalPages;
      this.currentPage = page - 1n;
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
        let addressType: 'bip44' | 'bip49' | 'bip84' = 'bip84';
        if (address.startsWith('3')) addressType = 'bip49';
        else if (address.startsWith('bc1')) addressType = 'bip84';
        const isMine = !!(
          data.keys &&
          data.keys.priv &&
          data.keys.priv === this.node.keys.priv
        );
        const addressRow: AddressRow = {
          id: address,
          keys: data.keys || { priv: '', pub: '' },
          bip44: { address: '', balance: 0, utxos: [] },
          bip49: { address: '', balance: 0, utxos: [] },
          bip84: { address: '', balance: 0, utxos: [] },
          isMine,
        };
        addressRow[addressType] = {
          address,
          balance: data.balance,
          utxos: data.utxos,
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
      this.totalRecords = BigInt(this.addresses.length);
      this.totalPages =
        (this.totalRecords + BigInt(this.pageSize) - 1n) /
        BigInt(this.pageSize);
    } else {
      // Modo 'all'
      const pageSize = BigInt(this.pageSize);
      const start = this.currentPage * pageSize + 1n;
      const N = BigInt(
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
      );
      this.addresses = [];
      for (let i = 0n; i < pageSize && start + i < N; i++) {
        const idx = start + i;
        const priv = idx.toString(16).padStart(64, '0');
        const pub = KeyService.derivePublicKey(priv);
        const bip44 = this.keyService.deriveBitcoinAddress(pub, 'bip44');
        const bip49 = this.keyService.deriveBitcoinAddress(pub, 'bip49');
        const bip84 = this.keyService.deriveBitcoinAddress(pub, 'bip84');
        const bip44Data = this.node.balances[bip44];
        const bip49Data = this.node.balances[bip49];
        const bip84Data = this.node.balances[bip84];
        this.addresses.push({
          id: priv,
          keys: { priv, pub },
          bip44: {
            address: bip44,
            balance: bip44Data?.balance || 0,
            utxos: bip44Data?.utxos || [],
          },
          bip49: {
            address: bip49,
            balance: bip49Data?.balance || 0,
            utxos: bip49Data?.utxos || [],
          },
          bip84: {
            address: bip84,
            balance: bip84Data?.balance || 0,
            utxos: bip84Data?.utxos || [],
          },
          isMine: priv === this.node.keys.priv,
        });
      }
      this.updateTotalPages();
    }
  }

  onPageChange(event: any) {
    this.first = event.first;
    this.rows = event.rows;
    this.loadAddresses();
  }

  onDisplayModeChange() {
    this.first = 0;
    this.loadAddresses();
  }

  getPrivKeyDisplay(keys: Keys): string {
    if (this.keyFormat === 'hex') {
      return '0x' + keys.priv;
    } else {
      // decimal
      try {
        return BigInt('0x' + keys.priv).toString(10);
      } catch {
        return '(inválido)';
      }
    }
  }

  getPubKeyDisplay(keys: Keys): string {
    if (this.keyFormat === 'hex') {
      return '0x' + keys.pub;
    } else {
      // decimal
      try {
        return BigInt('0x' + keys.pub).toString(10);
      } catch {
        return '(inválido)';
      }
    }
  }
}
