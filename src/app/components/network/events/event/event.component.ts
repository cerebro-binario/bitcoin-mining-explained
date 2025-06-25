import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NodeEvent } from '../../../../models/event-log.model';
import { BlockInfoPartsPipe } from './block-info.pipe';
import { EventLogMessagePipe } from './event-log/event-log-message.pipe';
import { EventLogVisualPipe } from './event-log/event-log-visual.pipe';
import { EventLogComponent } from './event-log/event-log.component';
@Component({
  selector: 'app-event',
  standalone: true,
  imports: [
    CommonModule,
    EventLogComponent,
    BlockInfoPartsPipe,
    EventLogMessagePipe,
    EventLogVisualPipe,
  ],
  templateUrl: './event.component.html',
})
export class EventComponent {
  @Input() event!: NodeEvent;

  txTotalOutput(tx: any): number {
    if (!tx?.outputs) return 0;
    return tx.outputs.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  }

  txInputAddresses(tx: any): string {
    if (!tx?.inputs) return '';
    return tx.inputs.map((i: any) => i.scriptPubKey).join(', ');
  }

  txOutputAddresses(tx: any): string {
    if (!tx?.outputs) return '';
    return tx.outputs.map((o: any) => o.scriptPubKey).join(', ');
  }

  copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }
}
