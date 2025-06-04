import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  EventEmitter,
  Inject,
  Input,
  Output,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PaginatorModule } from 'primeng/paginator';
import { Node, BitcoinAddress, Keys } from '../../../../../models/node';
import { KeyService } from '../../../../../services/key.service';
import { Subscription } from 'rxjs';

interface AddressRow {
  keys: Keys;
  legacy: { address: string; balance: number; utxos: any[] };
  p2sh: { address: string; balance: number; utxos: any[] };
  bech32: { address: string; balance: number; utxos: any[] };
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
  totalRecords = 0;
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

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private keyService: KeyService
  ) {}

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
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

  rowTrackBy(index: number, item: any): string {
    return item.legacy.address;
  }

  loadAddresses() {
    if (this.displayMode === 'with-balance') {
      this.addresses = [];
      for (const [address, data] of Object.entries(this.node.balances)) {
        if (!data || !data.balance || data.balance === 0) continue;
        // Determina o tipo de endereço baseado no prefixo
        let addressType: 'legacy' | 'p2sh' | 'bech32' = 'legacy';
        if (address.startsWith('3')) {
          addressType = 'p2sh';
        } else if (address.startsWith('bc1')) {
          addressType = 'bech32';
        }
        // Cria um AddressRow válido, preenchendo apenas o tipo correspondente
        const addressRow: AddressRow = {
          keys: data.keys || { priv: '', pub: '' },
          legacy: { address: '', balance: 0, utxos: [] },
          p2sh: { address: '', balance: 0, utxos: [] },
          bech32: { address: '', balance: 0, utxos: [] },
        };
        addressRow[addressType] = {
          address,
          balance: data.balance,
          utxos: data.utxos,
        };
        this.addresses.push(addressRow);
      }
      this.totalRecords = this.addresses.length;
    } else {
      // Gerar dinamicamente apenas os keypairs da página atual
      const start = this.first;
      const end = this.first + this.rows;
      this.addresses = [];
      for (let i = start; i < end; i++) {
        const priv = KeyService.derivePrivateKey(i);
        const pub = KeyService.derivePublicKey(priv);
        const legacy = KeyService.deriveBitcoinAddress(pub);
        const p2sh = KeyService.deriveP2SH_P2WPKH(pub);
        const bech32 = KeyService.deriveBech32(pub);
        // Buscar saldo/utxos de cada endereço
        const legacyData = this.node.balances[legacy] || {
          balance: 0,
          utxos: [],
        };
        const p2shData = this.node.balances[p2sh] || { balance: 0, utxos: [] };
        const bech32Data = this.node.balances[bech32] || {
          balance: 0,
          utxos: [],
        };
        this.addresses.push({
          keys: { priv, pub },
          legacy: {
            address: legacy,
            balance: legacyData.balance || 0,
            utxos: legacyData.utxos || [],
          },
          p2sh: {
            address: p2sh,
            balance: p2shData.balance || 0,
            utxos: p2shData.utxos || [],
          },
          bech32: {
            address: bech32,
            balance: bech32Data.balance || 0,
            utxos: bech32Data.utxos || [],
          },
        });
      }
      this.totalRecords = 1000000;
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
