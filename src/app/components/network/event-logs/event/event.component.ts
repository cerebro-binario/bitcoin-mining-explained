import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EventLog } from '../../../../models/event-log.model';

@Component({
  selector: 'app-event',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event.component.html',
})
export class EventComponent {
  @Input() event!: EventLog;
}
