import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Node } from '../../../models/node';
import { EventComponent } from './event/event.component';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, EventComponent],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
})
export class EventsComponent {
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
