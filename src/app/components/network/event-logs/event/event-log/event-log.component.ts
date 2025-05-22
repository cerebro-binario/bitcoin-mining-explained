import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EventLog, NodeEvent } from '../../../../../models/event-log.model';
import { BlockInfoPartsPipe } from '../block-info.pipe';
import { EventLogVisualPipe } from '../event-log-visual.pipe';

@Component({
  selector: 'app-event-log',
  standalone: true,
  imports: [CommonModule, EventLogVisualPipe, BlockInfoPartsPipe],
  templateUrl: './event-log.component.html',
})
export class EventLogComponent {
  @Input() log!: EventLog;
  @Input() event!: NodeEvent;
}
