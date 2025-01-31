import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-addresses',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CheckboxModule,
    SelectModule,
    TooltipModule,
    SelectButtonModule,
    ButtonModule,
  ],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss',
})
export class AddressesComponent implements OnInit {
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

  constructor(
    private addressService: AddressService,
    private route: ActivatedRoute,
    private router: Router
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
    return `${balance.toFixed(8)} BTC`;
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

  // Atualiza os parâmetros na URL
  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        format: this.isHexFormat ? 'hex' : 'decimal',
        filter: this.showOnlyWithBalance ? 'withBalance' : 'all',
        page: this.currentPage + 1,
      },
      queryParamsHandling: 'merge', // Mantém os parâmetros existentes
    });
  }

  // Atualiza a lista de chaves privadas e endereços na página atual
  private updateAddressesList(): void {
    if (this.showOnlyWithBalance) {
      this.keyPairs = this.addressService.getAllKeyPairsWithBalance();
      this.totalKeyPairs = BigInt(this.keyPairs.length);
      return;
    }

    this.keyPairs = [];

    const start = BigInt(this.currentPage * this.rowsPerPage + 1);
    const end = start + BigInt(this.rowsPerPage);

    for (let i = start; i < end; i++) {
      const privateKey = this.formatPrivateKey(i);
      const publicKey = this.addressService.generatePublicKey(privateKey);

      const p2pkh = this.addressService.generateBitcoinAddress(
        publicKey,
        'P2PKH'
      );
      const p2sh = this.addressService.generateBitcoinAddress(
        publicKey,
        'P2SH'
      );
      const p2wpkh = this.addressService.generateBitcoinAddress(
        publicKey,
        'P2WPKH'
      );

      const addresses: BitcoinAddresses = {
        P2PKH: {
          type: BITCOIN_ADDRESS_TYPES['P2PKH'],
          address: p2pkh,
          balance: this.addressService.getBalance(p2pkh) || 0,
        },
        P2SH: {
          type: BITCOIN_ADDRESS_TYPES['P2SH'],
          address: p2sh,
          balance: this.addressService.getBalance(p2sh) || 0,
        },
        P2WPKH: {
          type: BITCOIN_ADDRESS_TYPES['P2WPKH'],
          address: p2wpkh,
          balance: this.addressService.getBalance(p2pkh) || 0,
        },
      };

      this.keyPairs.push({
        privateKey,
        publicKey,
        addresses,
      });
    }

    this.totalKeyPairs = BigInt('0x' + MAX_PRIVATE_KEY);
  }

  // Alterna entre mostrar apenas endereços com saldo e todas as chaves privadas
  private updatePageState(onFilterToggle: boolean = false): void {
    const currentKey = this.showOnlyWithBalance ? 'withBalance' : 'all';
    const prevKey = this.showOnlyWithBalance ? 'all' : 'withBalance';

    if (onFilterToggle) {
      this.pageState[prevKey] = this.currentPage;
      this.currentPage = this.pageState[currentKey];
    } else {
      this.pageState[currentKey] = this.currentPage;
    }
  }
}
