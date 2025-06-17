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
import { Subject, takeUntil } from 'rxjs';
import { Node } from '../../../../../models/node';
import {
  BipType,
  BitcoinAddressData,
  TOTAL_PRIVATE_KEY_RECORDS,
} from '../../../../../models/wallet.model';
import { KeyService } from '../../../../../services/key.service';
import { ceilBigInt } from '../../../../../utils/tools';
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
  private destroy$ = new Subject<void>();

  @Input() node!: Node;
  @Output() close = new EventEmitter<void>();

  private addresses: BitcoinAddressData[] = [];
  addressesDisplay: BitcoinAddressData[] = [];

  displayMode: 'all-private-keys' | 'with-balance' = 'with-balance';
  displayModeOptions = [
    { label: 'Mostrar todos', value: 'all-private-keys' },
    { label: 'Apenas com saldo', value: 'with-balance' },
  ];
  addressType: BipType | 'all-bip-types' = 'bip84';

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

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
    this.node.balances$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateView();
    });
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

    // Para o caso de all, o array já está preenchido com o range passado pelo paginador
    // mas precisamos garantir que o array tenha o tamanho do pageSize
    // Para o caso de with-balance, o array possui todo o conjunto de endereços,
    // então precisamos do slice para paginar
    const addressDisplay =
      this.displayMode === 'all-private-keys'
        ? this.addresses.slice(0, this.pagination.pageSize)
        : this.addresses.slice(start, end);

    this.addressesDisplay = addressDisplay.map(this.identifyAddress);
  }

  updateTotalPages() {
    if (this.displayMode === 'all-private-keys') {
      // Valor máximo do grupo secp256k1
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
    // TODO: refatorar para não resetar a página quando o modo de exibição é alterado
    // armazenar o currentPage de acordo com o modo de exibição
    // e restaurar o currentPage quando o modo de exibição é alterado
    // ou quando o endereço de tipo é alterado
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
    }
    this.updateView();
  }
  goToNextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages - 1n) {
      this.pagination.currentPage++;
    }
    this.updateView();
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
    } catch {
      // ignore invalid input
    }
    this.updateView();
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
  }

  clearSort() {
    this.sortField = null;
    this.sortOrder = 0;
  }
  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
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

  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
    this.destroy$.next();
    this.destroy$.complete();
  }
}
