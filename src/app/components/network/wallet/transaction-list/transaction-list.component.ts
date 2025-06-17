import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TransactionView } from '../wallet.component';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './transaction-list.component.html',
})
export class TransactionListComponent {
  @Input() transactions: TransactionView[] = [];
  @Input() walletAddresses: string[] = [];
}
