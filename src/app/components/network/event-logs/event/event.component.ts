import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NodeEvent } from '../../../../models/event-log.model';
import { BlockInfoPartsPipe } from './block-info.pipe';
import { EventLogComponent } from './event-log/event-log.component';

@Component({
  selector: 'app-event',
  standalone: true,
  imports: [CommonModule, EventLogComponent, BlockInfoPartsPipe],
  templateUrl: './event.component.html',
})
export class EventComponent {
  @Input() event!: NodeEvent;
}
