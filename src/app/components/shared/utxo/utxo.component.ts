import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-utxo',
  templateUrl: './utxo.component.html',
  styleUrls: ['./utxo.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class UtxoComponent {
  @Input() value!: number; // em satoshis
  @Input() address!: string;
  @Input() txid!: string;
  @Input() vout!: number;
  @Input() scriptSig?: string; // assinatura (se spent)
  @Input() isSpent: boolean = false;
  @Input() isChange: boolean = false;
  @Input() isWallet: boolean = false;
  @Input() isCoinbase: boolean = false;
  @Input() compact: boolean = false; // modo compacto/expandido
  @Input() showActions: boolean = true; // mostrar botões copiar, etc.
  @Input() context?: 'input' | 'output' | 'utxo-list'; // para customizar ícone/cor

  get valueBTC(): string {
    return (this.value / 1e8).toLocaleString('pt-BR', {
      minimumFractionDigits: 8,
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
}
