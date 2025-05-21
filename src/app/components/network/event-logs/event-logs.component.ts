import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Node } from '../../../models/node';
import { EventComponent } from './event/event.component';

@Component({
  selector: 'app-event-logs',
  standalone: true,
  imports: [CommonModule, EventComponent],
  templateUrl: './event-logs.component.html',
  styleUrls: ['./event-logs.component.scss'],
})
export class EventLogsComponent {
  @Input() node!: Node;
  @Output() show = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  showAllLogs = false;

  constructor() {}

  showNodeLogs() {
    this.showAllLogs = true;
    this.show.emit();
  }

  closeLogs() {
    this.showAllLogs = false;
    this.close.emit();
  }
}
