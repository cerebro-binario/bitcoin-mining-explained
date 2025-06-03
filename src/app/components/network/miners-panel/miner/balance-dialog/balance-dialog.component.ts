import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, EventEmitter, Inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PaginatorModule } from 'primeng/paginator';
import { Node, BitcoinAddress, Keys } from '../../../../../models/node';
import { KeyService } from '../../../../../services/key.service';

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
export class BalanceDialogComponent {
  @Input() node!: Node;
  @Output() close = new EventEmitter<void>();

  displayMode: 'all' | 'with-balance' = 'all';
  first = 0;
  rows = 10;
  totalRecords = 0;
  addresses: BitcoinAddress[] = [];

  displayModeOptions = [
    { label: 'Mostrar todos', value: 'all' },
    { label: 'Apenas com saldo', value: 'with-balance' },
  ];

  keyFormat: 'hex' | 'dec' = 'hex';
  keyFormatOptions = [
    { label: 'Hexadecimal', value: 'hex' },
    { label: 'Decimal', value: 'dec' },
  ];

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private keyService: KeyService
  ) {}

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
    this.loadAddresses();
  }

  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
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
    return item.address;
  }

  loadAddresses() {
    if (this.displayMode === 'with-balance') {
      // Apenas endereços com saldo (poucos, pode listar todos)
      this.addresses = Object.entries(this.node.balances)
        .map(([address, data]) => ({
          address,
          balance: data?.balance || 0,
          nodeName: data?.nodeName,
          utxos: data?.utxos || [],
          keys: data?.keys || { priv: '', pub: '' },
        }))
        .filter((addr) => addr.balance > 0);
      this.totalRecords = this.addresses.length;
    } else {
      // Gerar dinamicamente apenas os endereços da página atual
      const start = this.first;
      const end = this.first + this.rows;
      this.addresses = [];
      for (let i = start; i < end; i++) {
        const priv = KeyService.derivePrivateKey(i);
        const pub = KeyService.derivePublicKey(priv);
        const address = KeyService.deriveBitcoinAddress(pub);
        // Verifica se tem saldo registrado
        const balanceData = this.node.balances[address];
        this.addresses.push({
          address,
          balance: balanceData?.balance || 0,
          nodeName: balanceData?.nodeName,
          utxos: balanceData?.utxos || [],
          keys: { priv, pub },
        });
      }
      // O total de registros é "infinito" para fins práticos, mas vamos limitar para simulação
      this.totalRecords = 1000000; // 1 milhão de páginas, por exemplo
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
