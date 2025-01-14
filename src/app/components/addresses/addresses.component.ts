import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { AddressService, AddressType } from '../../services/address.service';

@Component({
  selector: 'app-addresses',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CheckboxModule,
    SelectModule,
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
    address: string;
    balance: number;
  }[] = [];
  selectedAddressType: AddressType = 'P2PKH';
  addressTypes: { type: AddressType; name: string }[] = [
    { type: 'P2PKH', name: 'P2PKH (Legacy)' },
    { type: 'P2SH', name: 'P2SH (Multisig)' },
    { type: 'P2WPKH', name: 'P2WPKH (SegWit - Bech32)' },
  ];

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
      const address = this.addressService.generateBitcoinAddress(
        publicKey,
        this.selectedAddressType
      );

      if (this.addressService.isValidBitcoinAddress(address)) {
        const balance = this.addressService.getBalance(address) || 0;
        this.paginatedKeys.push({ privateKey, publicKey, address, balance });
      } else {
        console.error(`Endereço inválido gerado: ${address}`);
      }
    }
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

  // Manipula a mudança de página
  onPageChange(event: any): void {
    this.currentPage = event.page;
    this.updatePagination();
  }
}
