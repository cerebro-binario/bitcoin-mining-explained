import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Block } from '../../../models/block.model';

@Component({
  selector: 'app-block-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './block-details.component.html',
  styleUrls: ['./block-details.component.scss'],
})
export class BlockDetailsComponent {
  @Input() block!: Block;
}
