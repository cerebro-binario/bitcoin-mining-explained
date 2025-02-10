import { Component } from '@angular/core';
import { HashTargetComponent } from './hash-target/hash-target.component';
import { HashComponent } from './hash/hash.component';
import { HashesComparedComponent } from './hashes-compared/hashes-compared.component';
import { HexadecimalComponent } from './hexadecimal/hexadecimal.component';
import { DiceAnalogyComponent } from './dice-analogy/dice-analogy.component';

@Component({
  selector: 'app-tools',
  imports: [
    HexadecimalComponent,
    HashComponent,
    HashesComparedComponent,
    HashTargetComponent,
    DiceAnalogyComponent,
  ],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
})
export class ToolsComponent {}
