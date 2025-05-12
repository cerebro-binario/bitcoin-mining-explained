import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Node } from '../../../../../models/node';

@Component({
  selector: 'app-peers-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './peers-dialog.component.html',
  styleUrls: ['./peers-dialog.component.scss'],
})
export class PeersDialogComponent {
  @Input() miner!: Node;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
