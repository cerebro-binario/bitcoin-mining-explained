import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Block } from '../../../models/block.model';

@Component({
  selector: 'app-mining-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mining-block.component.html',
  styleUrls: ['./mining-block.component.scss'],
})
export class MiningBlockComponent {
  @Input() block?: Block;

  get target(): string {
    if (!this.block?.target) return '0';

    return '0x' + this.block.target.toString(16).padStart(64, '0');
  }
}
