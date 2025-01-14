import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { BitcoinAddress } from '../../models/address.model';
import { AddressService, AddressType } from '../../services/address.service';

@Component({
  selector: 'app-addresses',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CheckboxModule,
    SelectModule,
    TooltipModule,
  ],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss',
})
export class AddressesComponent implements OnInit {
  rowsPerPage = 100;
  currentPage = 0;
  showOnlyWithBalance = true;
  paginatedKeys: {
    privateKey: string;
    publicKey: string;
    p2pkh: BitcoinAddress;
    p2sh: BitcoinAddress;
    p2wpkh: BitcoinAddress;
    balance: number;
  }[] = [];
  selectedAddressType: AddressType = 'P2PKH';
  addressTypes: { type: AddressType; name: string }[] = [
    { type: 'P2PKH', name: 'P2PKH (Legacy)' },
    { type: 'P2SH', name: 'P2SH (Multisig)' },
    { type: 'P2WPKH', name: 'P2WPKH (SegWit - Bech32)' },
  ];
  hoveredAddress: string | null = null;
  expandedRows: { [key: string]: boolean } = {};

  constructor(private addressService: AddressService) {}

  ngOnInit(): void {
    this.updatePagination();
  }

  // Atualiza a lista de chaves privadas e endereços na página atual
  updatePagination(): void {
    this.paginatedKeys = [];

    const start = BigInt(this.currentPage * this.rowsPerPage);
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

      const balance = this.addressService.getBalance(p2pkh) || 0;

      this.paginatedKeys.push({
        privateKey,
        publicKey,
        p2pkh,
        p2sh,
        p2wpkh,
        balance,
      });
    }
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
  toggleFilter(): void {
    this.currentPage = 0;
    this.updatePagination();
  }

  // Método para encurtar endereços, mostrando apenas os primeiros e últimos caracteres
  shortenValue(value: string): string {
    return `${value.slice(0, 6)}...${value.slice(-6)}`;
  }

  // Manipula a mudança de página
  onPageChange(event: any): void {
    this.currentPage = event.page;
    this.updatePagination();
  }
}
