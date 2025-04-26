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
import { TransactionOutput } from '../../models/blockchain.model';
import { Subscription } from 'rxjs';
import { ClipboardService } from '../../services/clipboard.service';
import { UTXO } from '../../models/blockchain.model';

interface AddressInfo {
  address: string;
  balance: number;
  utxos: TransactionOutput[];
}

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './addresses.component.html',
  styleUrls: ['./addresses.component.scss'],
})
export class AddressesComponent implements OnInit, OnDestroy {
  addresses: AddressInfo[] = [];
  loading = true;
  showUtxosDialog = false;
  selectedAddress: AddressInfo | null = null;
  private subscription: Subscription | null = null;

  constructor(
    private blockchainService: BlockchainService,
    private clipboardService: ClipboardService
  ) {}

  ngOnInit() {
    this.loadAddresses();
    this.subscription = this.blockchainService.blocks$.subscribe(() => {
      this.loadAddresses();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private loadAddresses() {
    this.loading = true;
    const utxoSet = this.blockchainService.utxoSet$.getValue();

    // Criar um mapa para agrupar UTXOs por endereço
    const addressMap = new Map<string, AddressInfo>();

    // Processar cada UTXO
    utxoSet.forEach((utxo: TransactionOutput) => {
      const address = utxo.address;
      if (!addressMap.has(address)) {
        addressMap.set(address, {
          address,
          balance: 0,
          utxos: [],
        });
      }

      const addressInfo = addressMap.get(address)!;
      addressInfo.balance += utxo.amount;
      addressInfo.utxos.push(utxo);
    });

    // Converter o mapa em array e ordenar por saldo
    this.addresses = Array.from(addressMap.values()).sort(
      (a, b) => b.balance - a.balance
    );

    this.loading = false;
  }

  formatBalance(balance: number): string {
    return `₿ ${balance.toFixed(8)}`;
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  showUtxos(address: AddressInfo) {
    this.selectedAddress = address;
    this.showUtxosDialog = true;
  }
}
