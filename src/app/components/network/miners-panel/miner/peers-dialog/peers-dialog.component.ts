import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  Inject,
  ElementRef,
} from '@angular/core';
import { Node } from '../../../../../models/node';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-peers-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './peers-dialog.component.html',
  styleUrls: ['./peers-dialog.component.scss'],
})
export class PeersDialogComponent implements OnInit, OnDestroy {
  @Input() miner!: Node;
  @Output() close = new EventEmitter<void>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    this.document.body.classList.add('overflow-hidden');
  }
  ngOnDestroy() {
    this.document.body.classList.remove('overflow-hidden');
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
