import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import {
  hexToBinary,
  hexToDecimal,
  hexToText,
  textToHex,
} from '../../../utils/tools';

@Component({
  selector: 'app-hexadecimal',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    MessageModule,
    IftaLabelModule,
    TextareaModule,
  ],
  templateUrl: './hexadecimal.component.html',
  styleUrl: './hexadecimal.component.scss',
})
export class HexadecimalComponent {
  content: string = ''; // Conteúdo do textarea
  hex: string = '';
  binary: string = '';
  decimal: string = '';

  generateContent(): string {
    this.content = hexToText(this.hex);
    return this.content;
  }

  generateHex(): string {
    this.hex = textToHex(this.content);
    return this.hex;
  }

  // Gera o hash (usando SHA-256 como exemplo)
  generateBinary(): string {
    if (this.hex === '') {
      this.binary = '';
    } else {
      this.binary = hexToBinary(this.hex);
    }

    return this.binary;
  }

  generateDecimal(): string {
    if (this.hex === '') {
      this.decimal = '';
    } else {
      this.decimal = hexToDecimal(this.hex);
    }

    return this.decimal;
  }

  // Validar binary
  isBinaryValid(): boolean {
    // 1. Verifica se o valor está no formato binário (apenas 0s e 1s)
    const isBinaryFormat = /^[01]+$/.test(this.binary);

    if (!isBinaryFormat) {
      return false; // Retorna falso se não estiver no formato binário
    }

    // 2. Converte o conteúdo (hex) para binário e compara

    // Transforma o content para hexadecimal e depois para binário
    const contentToBinary = hexToBinary(this.hex);

    // Verifica se o binário passado (binary) é equivalente ao conteúdo convertido
    return this.binary === contentToBinary;
  }

  isDecimalValid(): boolean {
    // 1. Verifica se o valor está no formato decimal (apenas números)
    const isDecimalFormat = /^[0-9]+$/.test(this.decimal);
    if (!isDecimalFormat) {
      return false; // Retorna falso se não estiver no formato decimal
    }

    // Transforma o content para hexadecimal e depois para decimal
    const contentToDecimal = hexToDecimal(this.hex);

    // Verifica se o decimal fornecido é equivalente ao conteúdo convertido
    return this.decimal === contentToDecimal;
  }

  onContentChange() {
    this.generateHex();
    this.generateBinary();
    this.generateDecimal();
  }

  onHexChange() {
    this.generateContent();
    this.generateBinary();
    this.generateDecimal();
  }
}
