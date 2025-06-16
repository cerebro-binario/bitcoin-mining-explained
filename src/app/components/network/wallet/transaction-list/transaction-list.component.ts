import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TransactionView } from '../wallet.component';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transaction-list.component.html',
})
export class TransactionListComponent {
  @Input() transactions: TransactionView[] = [];
}
