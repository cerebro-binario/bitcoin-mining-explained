import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Transaction } from '../../models/transaction.model';
import { MempoolService } from '../../services/mempool.service';

@Component({
  selector: 'app-mempool',
  imports: [ButtonModule, TableModule, RouterModule],
  templateUrl: './mempool.component.html',
  styleUrl: './mempool.component.scss',
})
export class MempoolComponent {
  transactions: Transaction[] = [];

  constructor(private mempoolService: MempoolService) {}

  ngOnInit(): void {
    this.transactions = this.mempoolService.transactions;
  }
}
