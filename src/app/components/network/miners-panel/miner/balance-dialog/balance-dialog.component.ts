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
      // Modo 'all': gerar todas as possíveis chaves privadas secp256k1
      const pageSize = this.rows;
      const pageIndex = Math.floor(this.first / this.rows);
      const start = pageIndex * pageSize + 1; // começa em 1
      const end = start + pageSize;
      // Valor máximo do grupo secp256k1
      const N = BigInt(
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
      );
      this.addresses = [];
      for (let i = 0; i < pageSize; i++) {
        const idx = BigInt(start + i);
        if (idx >= N) break;
        const priv = idx.toString(16).padStart(64, '0');
        const pub = KeyService.derivePublicKey(priv);
        const legacy = KeyService.deriveBitcoinAddress(pub);
        const p2sh = KeyService.deriveP2SH_P2WPKH(pub);
        const bech32 = KeyService.deriveBech32(pub);
        // Busca saldo/utxos se existirem
        const legacyData = this.node.balances[legacy];
        const p2shData = this.node.balances[p2sh];
        const bech32Data = this.node.balances[bech32];
        this.addresses.push({
          keys: { priv, pub },
          legacy: {
            address: legacy,
            balance: legacyData?.balance || 0,
            utxos: legacyData?.utxos || [],
          },
          p2sh: {
            address: p2sh,
            balance: p2shData?.balance || 0,
            utxos: p2shData?.utxos || [],
          },
          bech32: {
            address: bech32,
            balance: bech32Data?.balance || 0,
            utxos: bech32Data?.utxos || [],
          },
        });
      }
      this.totalRecords = Math.min(Number(N - 1n), Number.MAX_SAFE_INTEGER);
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
