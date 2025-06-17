import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-pagination-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  templateUrl: './pagination-bar.component.html',
})
export class PaginationBarComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 1;
  @Input() percent: number = 0;
  @Input() prevDisabled: boolean = false;
  @Input() nextDisabled: boolean = false;

  @Output() goToFirst = new EventEmitter<void>();
  @Output() goToPrevious = new EventEmitter<void>();
  @Output() goToNext = new EventEmitter<void>();
  @Output() goToLast = new EventEmitter<void>();
  @Output() jumpToPage = new EventEmitter<number>();

  jumpPageInput: string = '';

  onJumpToPage() {
    const page = Number(this.jumpPageInput);
    if (!isNaN(page) && page > 0 && page <= this.totalPages) {
      this.jumpToPage.emit(page);
    }
    this.jumpPageInput = '';
  }
}
