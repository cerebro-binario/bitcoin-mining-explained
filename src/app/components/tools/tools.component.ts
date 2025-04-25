import { Component } from '@angular/core';
import { HashTargetComponent } from './hash-target/hash-target.component';
import { HashComponent } from './hash/hash.component';
import { HashesComparedComponent } from './hashes-compared/hashes-compared.component';
import { HexadecimalComponent } from './hexadecimal/hexadecimal.component';
import { DiceAnalogyComponent } from './dice-analogy/dice-analogy.component';
import { BitcoinEmissionChartComponent } from './bitcoin-emission-chart/bitcoin-emission-chart.component';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-tools',
  templateUrl: './tools.component.html',
  styleUrls: ['./tools.component.scss'],
  standalone: true,
  imports: [
    TooltipModule,
    HexadecimalComponent,
    HashComponent,
    HashesComparedComponent,
    HashTargetComponent,
    DiceAnalogyComponent,
    BitcoinEmissionChartComponent,
  ],
})
export class ToolsComponent {
  isFullscreen: { [key: string]: boolean } = {
    hexadecimal: false,
    hash: false,
    'hashes-compared': false,
    'dice-analogy': false,
    'hash-target': false,
    'bitcoin-emission-chart': false,
  };

  toggleFullscreen(section: string) {
    // First, minimize all other sections
    Object.keys(this.isFullscreen).forEach((key) => {
      if (key !== section) {
        this.isFullscreen[key] = false;
      }
    });

    // Then toggle the selected section
    this.isFullscreen[section] = !this.isFullscreen[section];
  }
}
