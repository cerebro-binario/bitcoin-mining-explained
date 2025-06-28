import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TransactionView } from '../wallet.component';
import { UtxoComponent } from '../../../shared/utxo/utxo.component';

// Função utilitária para copiar para a área de transferência
function copyToClipboard(text: string) {
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, TableModule, RouterLink, UtxoComponent],
  templateUrl: './transaction-list.component.html',
})
export class TransactionListComponent {
  @Input() transactions: TransactionView[] = [];
  @Input() walletAddresses: string[] = [];
  @Input() totalTransactions: number = 0;
  @Input() currentPage: number = 1;
  @Input() pageSize: number = 10;
  @Input() nodeId: number | null = null;

  copyToClipboard(text: string) {
    copyToClipboard(text);
  }
}
