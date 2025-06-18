import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-address-details-dialog',
  templateUrl: './address-details-dialog.component.html',
  styleUrls: ['./address-details-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
})
export class AddressDetailsDialogComponent {
  @Input() visible = false;
  @Input() addressData: any;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }
}
