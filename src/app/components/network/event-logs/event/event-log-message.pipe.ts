import { Pipe, PipeTransform } from '@angular/core';
import {
  EventLogType,
  NodeEventType,
} from '../../../../models/event-log.model';
import { EVENT_LOG_VISUAL_MAP } from './event-log-visual-map';

function getByPath(obj: any, path: string): any {
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
}

@Pipe({ name: 'eventLogMessage' })
export class EventLogMessagePipe implements PipeTransform {
  transform(type: EventLogType | NodeEventType, data: any): string {
    const visual = EVENT_LOG_VISUAL_MAP[type];
    if (!visual) return '';
    const template = visual.template || visual.label;
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) =>
      getByPath(data, key)
    );
  }
}
