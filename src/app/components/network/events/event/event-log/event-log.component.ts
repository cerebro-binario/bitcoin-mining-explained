import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NodeEvent, NodeEventLog } from '../../../../../models/event-log.model';
import { copyToClipboard } from '../../../../../utils/tools';
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

  copyToClipboard(value: string) {
    copyToClipboard(value);
  }

  txTotalOutput(tx: any): number {
    if (!tx?.outputs) return 0;
    return tx.outputs.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  }
}
