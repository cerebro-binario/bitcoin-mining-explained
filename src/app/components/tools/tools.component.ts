import { Component } from '@angular/core';
import { HashTargetComponent } from './hash-target/hash-target.component';
import { HashComponent } from './hash/hash.component';
import { HashesComparedComponent } from './hashes-compared/hashes-compared.component';
import { HexadecimalComponent } from './hexadecimal/hexadecimal.component';
import { DiceAnalogyComponent } from './dice-analogy/dice-analogy.component';
import { BitcoinEmissionChartComponent } from './bitcoin-emission-chart/bitcoin-emission-chart.component';

@Component({
  selector: 'app-tools',
  imports: [
    HexadecimalComponent,
    HashComponent,
    HashesComparedComponent,
    HashTargetComponent,
    DiceAnalogyComponent,
    BitcoinEmissionChartComponent,
  ],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
})
export class ToolsComponent {}
