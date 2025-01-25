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
import {
  BITCOIN_ADDRESS_TYPES,
  BitcoinAddresses,
  KeyPair,
  MAX_PRIVATE_KEY,
} from '../../models/address.model';
import { AddressService } from '../../services/address.service';

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
    // Restaurar configurações dos query params
    this.route.queryParams.subscribe((params) => {
      this.isHexFormat = params['format'] === 'decimal' ? false : true;
      this.showOnlyWithBalance =
        params['filter'] === 'withBalance' ? true : false;

      const filterKey = this.showOnlyWithBalance ? 'withBalance' : 'all';
      this.currentPage =
        params['page'] && params['page'] > 0
          ? +params['page'] - 1
          : this.pageState[filterKey];

      this.updatePagination();
    });
  }

  get totalPages() {
    const rowsPerPage = BigInt(this.rowsPerPage);
    const lastPage = this.totalKeyPairs % rowsPerPage > 0 ? 1 : 0;

    return this.totalKeyPairs / rowsPerPage + BigInt(lastPage);
  }

  // Atualiza os parâmetros na URL
  updateQueryParamsAndPagination(): void {
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: {
          format: this.isHexFormat ? 'hex' : 'decimal',
          filter: this.showOnlyWithBalance ? 'withBalance' : 'all',
          page: this.currentPage + 1,
        },
        queryParamsHandling: 'merge', // Mantém os parâmetros existentes
      })
      .finally(() => this.updatePagination());
  }

  // Atualiza a lista de chaves privadas e endereços na página atual
  updatePagination(): void {
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

  // Alterna entre mostrar apenas endereços com saldo e todas as chaves privadas
  updatePageState(): void {
    if (this.showOnlyWithBalance) {
      this.pageState['all'] = this.currentPage;
      this.currentPage = this.pageState['withBalance'];
    } else {
      this.pageState['withBalance'] = this.currentPage;
      this.currentPage = this.pageState['all'];
    }
  }

  // Alterna entre hexadecimal e decimal
  formatKey(key: string): string {
    if (this.isHexFormat) {
      return '0x' + key; // Retorna como hexadecimal
    } else {
      return BigInt('0x' + key).toString(10); // Converte para decimal
    }
  }

  // Método para encurtar endereços, mostrando apenas os primeiros e últimos caracteres
  shortenValue(value: string, size: number = 6): string {
    if (value.length < 13) return value;

    return `${value.slice(0, size)}...${value.slice(-size)}`;
  }

  // Manipula a mudança de página
  onPageChange(event: any): void {
    this.currentPage = event.page;
    this.updateQueryParamsAndPagination();
  }

  formatBalance(balance: number): string {
    return `${balance.toFixed(8)} BTC`;
  }

  isFirstPage() {
    return this.currentPage === 0;
  }

  prev() {
    this.currentPage -= 1;
    this.updateQueryParamsAndPagination();
  }

  reset() {
    this.currentPage = 0;
    this.updateQueryParamsAndPagination();
  }

  next() {
    this.currentPage += 1;
    this.updateQueryParamsAndPagination();
  }

  isLastPage() {
    const start = BigInt(this.currentPage * this.rowsPerPage + 1);
    const end = start + BigInt(this.rowsPerPage);

    return end >= BigInt('0x' + MAX_PRIVATE_KEY);
  }
}
