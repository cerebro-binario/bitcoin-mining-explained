import { BlockNode } from './block.model';
import { NodeEvent, NodeEventLog } from './event-log.model';

export interface Height {
  n: number;
  blocks: BlockNode[];
  events: (NodeEvent | NodeEventLog)[];
}
