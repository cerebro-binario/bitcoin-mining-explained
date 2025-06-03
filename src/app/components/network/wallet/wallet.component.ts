import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    FormsModule,
  ],
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  toAddress = '';
  amount: number | null = null;
  transactions: { id: string; to: string; amount: number; status: string }[] =
    [];

  sendTransaction() {
    if (!this.toAddress || !this.amount) return;
    const tx = {
      id: Math.random().toString(36).substring(2, 10),
      to: this.toAddress,
      amount: this.amount,
      status: 'pendente',
    };
    this.transactions.unshift(tx);
    this.toAddress = '';
    this.amount = null;
  }
}
