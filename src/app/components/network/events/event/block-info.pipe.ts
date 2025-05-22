import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'blockInfoParts' })
export class BlockInfoPartsPipe implements PipeTransform {
  transform(block: any): { value: string; class: string }[] {
    if (!block) return [];
    return [
      { value: `#${block.height}`, class: 'text-blue-400 font-semibold' },
      { value: '•', class: 'text-zinc-400 mx-1' },
      {
        value: `${block.hash?.slice(0, 32)}...`,
        class: 'font-mono text-zinc-400',
      },
      { value: '•', class: 'text-zinc-400 mx-1' },
      { value: `v${block.consensusVersion}`, class: 'text-purple-400 italic' },
    ];
  }
}
