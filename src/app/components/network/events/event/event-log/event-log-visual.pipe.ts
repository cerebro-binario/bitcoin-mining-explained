import { Pipe, PipeTransform } from '@angular/core';
import {
  EventLogType,
  NodeEventType,
} from '../../../../../models/event-log.model';
import { EVENT_LOG_VISUAL_MAP, EventLogVisual } from './event-log-visual-map';

@Pipe({ name: 'eventLogVisual' })
export class EventLogVisualPipe implements PipeTransform {
  transform(type: EventLogType | NodeEventType): EventLogVisual {
    return EVENT_LOG_VISUAL_MAP[type] || { color: '', icon: '', label: type };
  }
}
