import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip';
import { BitcoinAddressInfo, KeyPair } from '../../models/address.model';
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
    ToggleButtonModule,
  ],
  templateUrl: './addresses.component.html',
  styleUrl: './addresses.component.scss',
})
export class AddressesComponent implements OnInit {
  rowsPerPage = 100;
  currentPage = 0;
  showOnlyWithBalance = true;
  keyPairs: KeyPair[] = [];
  expandedRows: { [key: string]: boolean } = {};
  isHexFormat: boolean = true;

  constructor(private addressService: AddressService) {}

  ngOnInit(): void {
    this.updatePagination();
  }

  // Atualiza a lista de chaves privadas e endereços na página atual
  updatePagination(): void {
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

      const addresses: BitcoinAddressInfo[] = [
        {
          type: this.addressService.getAddressTypeByCode('P2PKH'),
          address: p2pkh,
          balance: this.addressService.getBalance(p2pkh) || 0,
        },
        {
          type: this.addressService.getAddressTypeByCode('P2SH'),
          address: p2sh,
          balance: this.addressService.getBalance(p2sh) || 0,
        },
        {
          type: this.addressService.getAddressTypeByCode('P2WPKH'),
          address: p2wpkh,
          balance: this.addressService.getBalance(p2pkh) || 0,
        },
      ];

      this.keyPairs.push({
        privateKey,
        publicKey,
        addresses,
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

  // Alterna entre hexadecimal e decimal
  formatKey(key: string): string {
    if (this.isHexFormat) {
      return '0x' + key; // Retorna como hexadecimal
    } else {
      return BigInt('0x' + key).toString(10); // Converte para decimal
    }
  }

  // Método para encurtar endereços, mostrando apenas os primeiros e últimos caracteres
  shortenValue(value: string): string {
    if (value.length < 13) return value;

    return `${value.slice(0, 6)}...${value.slice(-6)}`;
  }

  // Manipula a mudança de página
  onPageChange(event: any): void {
    this.currentPage = event.page;
    this.updatePagination();
  }

  formatBalance(balance: number): string {
    return `${balance.toFixed(8)} BTC`;
  }
}
