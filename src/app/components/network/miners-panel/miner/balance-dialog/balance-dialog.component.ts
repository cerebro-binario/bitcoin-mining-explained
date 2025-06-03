import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, EventEmitter, Inject, Input, Output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { Node } from '../../../../../models/node';

@Component({
  selector: 'app-balance-dialog',
  templateUrl: './balance-dialog.component.html',
  standalone: true,
  imports: [CommonModule, DialogModule],
})
export class BalanceDialogComponent {
  @Input() node!: Node;
  @Output() close = new EventEmitter<void>();

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
  }
  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
  }

  getAllAddresses() {
    return Object.entries(this.node.balances)
      .filter(([address, data]) => !!data)
      .map(([address, data]) => ({
        address,
        balance: data!.balance,
        utxos: data!.utxos,
      }));
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
