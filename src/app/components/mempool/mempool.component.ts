import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { MempoolService } from '../../services/mempool.service';

@Component({
  selector: 'app-mempool',
  imports: [ButtonModule, TableModule, RouterModule],
  templateUrl: './mempool.component.html',
  styleUrl: './mempool.component.scss',
})
export class MempoolComponent {
  transactions: any = [];

  constructor(private transactionService: MempoolService) {}

  ngOnInit(): void {
    this.transactionService.transactions$.subscribe((transactions) => {
      this.transactions = transactions;
    });
  }
}
