import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TransactionView } from '../wallet.component';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, TableModule, RouterLink],
  templateUrl: './transaction-list.component.html',
})
export class TransactionListComponent {
  @Input() transactions: TransactionView[] = [];
  @Input() walletAddresses: string[] = [];
  @Input() totalTransactions: number = 0;
  @Input() currentPage: number = 1;
  @Input() pageSize: number = 10;
  @Input() nodeId: number | null = null;
}
