import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NodeEventLog, NodeEvent } from '../../../../../models/event-log.model';
import { BlockInfoPartsPipe } from '../block-info.pipe';
import { EventLogMessagePipe } from './event-log-message.pipe';
import { EventLogVisualPipe } from './event-log-visual.pipe';
@Component({
  selector: 'app-event-log',
  standalone: true,
  imports: [
    CommonModule,
    EventLogVisualPipe,
    BlockInfoPartsPipe,
    EventLogMessagePipe,
  ],
  templateUrl: './event-log.component.html',
  styleUrls: ['./event-log.component.scss'],
})
export class EventLogComponent {
  @Input() log!: NodeEventLog;
  @Input() event!: NodeEvent;
}
