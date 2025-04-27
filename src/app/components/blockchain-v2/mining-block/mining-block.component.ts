import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Block } from '../../../models/block.model';

@Component({
  selector: 'app-mining-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-zinc-800 rounded-lg shadow p-6 border border-zinc-700">
      <h3 class="text-lg font-semibold text-blue-400 mb-4">Bloco Atual</h3>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <span class="text-xs text-zinc-400">ID:</span>
          <span class="font-mono text-sm text-white">{{ block?.id }}</span>
        </div>

        <div>
          <span class="text-xs text-zinc-400">Timestamp:</span>
          <span class="font-mono text-sm text-white">{{
            block?.timestamp | date : 'medium'
          }}</span>
        </div>

        <div class="col-span-2">
          <span class="text-xs text-zinc-400">Hash Anterior:</span>
          <span class="font-mono text-sm text-white block truncate">{{
            block?.previousHash ||
              '0000000000000000000000000000000000000000000000000000000000000000'
          }}</span>
        </div>

        <div class="col-span-2">
          <span class="text-xs text-zinc-400">Hash Atual:</span>
          <span class="font-mono text-sm text-white block truncate">{{
            block?.hash ||
              '0000000000000000000000000000000000000000000000000000000000000000'
          }}</span>
        </div>

        <div>
          <span class="text-xs text-zinc-400">Nonce:</span>
          <span class="font-mono text-sm text-white">{{ block?.nonce }}</span>
        </div>

        <div>
          <span class="text-xs text-zinc-400">Dificuldade:</span>
          <span class="font-mono text-sm text-white">{{
            block?.difficulty
          }}</span>
        </div>

        <div class="col-span-2">
          <span class="text-xs text-zinc-400">Transações:</span>
          <span class="font-mono text-sm text-white">{{
            block?.transactions.length || 0
          }}</span>
        </div>
      </div>
    </div>
  `,
})
export class MiningBlockComponent {
  @Input() block?: Block;
}
