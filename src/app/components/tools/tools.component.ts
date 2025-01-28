import { Component } from '@angular/core';
import { HashComponent } from './hash/hash.component';
import { HexadecimalComponent } from './hexadecimal/hexadecimal.component';

@Component({
  selector: 'app-tools',
  imports: [HexadecimalComponent, HashComponent],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
})
export class ToolsComponent {}
