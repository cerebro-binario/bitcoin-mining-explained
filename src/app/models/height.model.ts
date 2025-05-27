import { BlockNode } from './block.model';
import { NodeEvent } from './event-log.model';

export interface Height {
  n: number;
  blocks: BlockNode[];
  events: NodeEvent[];
}
