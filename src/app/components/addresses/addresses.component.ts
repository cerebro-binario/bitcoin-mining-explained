import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { tap } from 'rxjs';
import {
  BITCOIN_ADDRESS_TYPES,
  BitcoinAddresses,
  KeyPair,
  MAX_PRIVATE_KEY,
} from '../../models/address.model';
import { AddressService } from '../../services/address.service';
import { hexToDecimal, shortenValue } from '../../utils/tools';
import { BlockchainService } from '../../services/blockchain.service';
import { Transaction } from '../../models/block.model';
import { Subscription } from 'rxjs';
import { DialogModule } from 'primeng/dialog';

interface AddressInfo {
  address: string;
  balance: number;
  utxos: Transaction[];
}

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CheckboxModule,
    SelectModule,
    TooltipModule,
    SelectButtonModule,
    ButtonModule,
    DialogModule,
  ],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss',
})
export class AddressesComponent implements OnInit, OnDestroy {
  rowsPerPage = 10;
  currentPage = 0;
  showOnlyWithBalance = true;
  keyPairs: KeyPair[] = [];
  totalKeyPairs = BigInt(0);
  expandedRows: { [key: string]: boolean } = {};
  isHexFormat: boolean = true;

  // Estados de paginação para cada filtro
  pageState = {
    all: 0,
    withBalance: 0,
  };

  addresses: AddressInfo[] = [];
  loading = true;
  showUtxosDialog = false;
  selectedAddress: AddressInfo | null = null;
  private subscription: Subscription | null = null;
  private utxoSubscription: Subscription | null = null;

  constructor(
    private addressService: AddressService,
    private route: ActivatedRoute,
    private router: Router,
    private blockchainService: BlockchainService
  ) {}

  ngOnInit(): void {
    // Restaurar configurações do localStorage
    this.loadStateFromLocalStorage();

    this.loadStateFromQueryParams().subscribe(() => {
      // Atualizar a lista de endereços que será apresentada na tabela de acordo com os filtros e paginação
      this.updateAddressesList();

      this.updateQueryParams();
      // Atualizar localStorage (caso query params sobrescrevam os params vindos do local storage)
      this.saveStateToLocalStorage();
    });

    this.subscription = this.blockchainService.blocks$.subscribe(() => {
      this.loadAddresses();
    });

    this.utxoSubscription = this.blockchainService.utxoSet$.subscribe(() => {
      this.loadAddresses();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.utxoSubscription) {
      this.utxoSubscription.unsubscribe();
    }
  }

  get totalPages() {
    const rowsPerPage = BigInt(this.rowsPerPage);
    const lastPage = this.totalKeyPairs % rowsPerPage > 0 ? 1 : 0;

    return this.totalKeyPairs / rowsPerPage + BigInt(lastPage);
  }

  // Expande ou colapsa a linha da tabela ao clicar
  toggleRow(item: any): void {
    const key = item.privateKey;
    this.expandedRows[key] = !this.expandedRows[key];
  }

  // Copia um valor para a área de transferência
  copyToClipboard(value: string): void {
    navigator.clipboard.writeText(value).then(() => {
      console.log(`Copiado: ${value}`);
    });
  }

  // Gera a chave privada no formato hexadecimal (64 caracteres)
  formatPrivateKey(index: BigInt): string {
    return index.toString(16).padStart(64, '0'); // Converte para hexadecimal
  }

  // Alterna entre hexadecimal e decimal
  formatKey(key: string): string {
    if (this.isHexFormat) {
      return '0x' + key; // Retorna como hexadecimal
    } else {
      return hexToDecimal(key); // Converte para decimal
    }
  }

  // Método para encurtar endereços, mostrando apenas os primeiros e últimos caracteres
  shortenValue(value: string, size: number = 6): string {
    return shortenValue(value, size);
  }

  // Manipula a mudança de página
  onPageChange(event: any): void {
    this.currentPage = event.page;

    this.updatePageState();
    this.updateAddressesList();

    this.updateQueryParams();
    this.saveStateToLocalStorage();
  }

  formatBalance(balance: number): string {
    return `₿ ${balance.toFixed(8)}`;
  }

  isFirstPage() {
    return this.currentPage === 0;
  }

  prev() {
    this.currentPage -= 1;

    this.updatePageState();
    this.updateAddressesList();

    this.updateQueryParams();
    this.saveStateToLocalStorage();
  }

  reset() {
    this.currentPage = 0;
    this.updatePageState();
    this.updateQueryParams();
    this.updateAddressesList();
  }

  next() {
    this.currentPage += 1;

    this.updatePageState();
    this.updateAddressesList();

    this.updateQueryParams();
    this.saveStateToLocalStorage();
  }

  isLastPage() {
    const start = BigInt(this.currentPage * this.rowsPerPage + 1);
    const end = start + BigInt(this.rowsPerPage);

    return end >= BigInt('0x' + MAX_PRIVATE_KEY);
  }

  toggleFormat() {
    this.updateQueryParams();
    this.saveStateToLocalStorage();
  }

  // Filtrar a lista de endereços com base na escolha entre 'Apenas com saldo' e 'Todos'
  filterAddresses() {
    this.updatePageState(true);
    this.updateAddressesList();

    this.updateQueryParams();
    this.saveStateToLocalStorage();
  }

  // Carregar configurações do localStorage
  private loadStateFromLocalStorage(): void {
    const savedState = localStorage.getItem('addressesPageState');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.isHexFormat = state.isHexFormat ?? true;
      this.showOnlyWithBalance = state.showOnlyWithBalance ?? false;
      this.currentPage = state.currentPage ?? 1;
      this.pageState = state.pageState || { all: 1, withBalance: 1 };
    }
  }

  // Salvar configurações no localStorage
  private saveStateToLocalStorage(): void {
    const state = {
      isHexFormat: this.isHexFormat,
      showOnlyWithBalance: this.showOnlyWithBalance,
      currentPage: this.currentPage,
      pageState: this.pageState,
    };
    localStorage.setItem('addressesPageState', JSON.stringify(state));
  }

  // Restaurar configurações dos query params
  private loadStateFromQueryParams() {
    return this.route.queryParams.pipe(
      tap((params) => {
        this.isHexFormat =
          params['format'] === 'decimal' ? false : this.isHexFormat;
        this.showOnlyWithBalance =
          params['filter'] === 'withBalance' ? true : this.showOnlyWithBalance;

        const filterKey = this.showOnlyWithBalance ? 'withBalance' : 'all';
        this.currentPage =
          params['page'] && params['page'] > 0
            ? +params['page'] - 1
            : this.pageState[filterKey];
      })
    );
  }

  private updateQueryParams(): void {
    const queryParams = {
      format: this.isHexFormat ? 'hex' : 'decimal',
      filter: this.showOnlyWithBalance ? 'withBalance' : 'all',
      page: this.currentPage + 1,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private updateAddressesList(): void {
    const start = BigInt(this.currentPage * this.rowsPerPage + 1);
    const end = start + BigInt(this.rowsPerPage);

    this.keyPairs = this.addressService.getKeyPairs(start, end);
    this.totalKeyPairs = this.addressService.getTotalKeyPairs();

    // Atualizar a lista de endereços com saldos
    this.loadAddresses();
  }

  private updatePageState(onFilterToggle: boolean = false): void {
    const filterKey = this.showOnlyWithBalance ? 'withBalance' : 'all';
    this.pageState[filterKey] = this.currentPage;
  }

  private loadAddresses() {
    this.loading = true;
    const utxoSet = this.blockchainService.getUtxoSet();

    this.addresses = this.keyPairs.map((keyPair) => {
      const address = keyPair.addresses['P2PKH'].address;
      const utxos = Array.from(utxoSet.values()).filter(
        (utxo) => utxo.address === address
      );
      const balance = utxos.reduce((sum, utxo) => sum + utxo.amount, 0);

      return {
        address,
        balance,
        utxos,
      };
    });

    this.loading = false;
  }

  showUtxos(address: AddressInfo) {
    this.selectedAddress = address;
    this.showUtxosDialog = true;
  }
}
