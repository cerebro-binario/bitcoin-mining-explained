import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, EventEmitter, Inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Node } from '../../../../../models/node';
import { KeyService } from '../../../../../services/key.service';
import { AddressListComponent } from '../../../wallet/address-list/address-list.component';

@Component({
  selector: 'app-wallet-dialog',
  templateUrl: './wallet-dialog.component.html',
  standalone: true,
  imports: [CommonModule, AddressListComponent, ButtonModule, FormsModule],
})
export class WalletDialogComponent {
  @Input() node!: Node;
  @Output() close = new EventEmitter<void>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private keyService: KeyService
  ) {}

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose() {
    this.close.emit();
  }

  deriveNextAddress() {
    if (!this.node.wallet) return;

    const newAddress = this.keyService.deriveNextBitcoinAddress(
      this.node.wallet
    );

    if (newAddress) {
      this.node.wallet.addresses = [...this.node.wallet.addresses, newAddress];
    }
  }
}
