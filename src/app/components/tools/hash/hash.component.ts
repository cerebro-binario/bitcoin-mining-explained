import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { dupHashSHA256, hexToText, textToHex } from '../../../utils/tools';

@Component({
  selector: 'app-hash',
  imports: [
    CommonModule,
    FormsModule,
    TextareaModule,
    IftaLabelModule,
    CardModule,
    MessageModule,
  ],
  templateUrl: './hash.component.html',
  styleUrl: './hash.component.scss',
})
export class HashComponent {
  content: string = ''; // Conteúdo do textarea
  hash: string = '';
  hex: string = '';

  generateContent(): string {
    this.content = hexToText(this.hex);
    return this.content;
  }

  generateHex(): string {
    this.hex = textToHex(this.content);
    return this.hex;
  }

  // Gera o hash (usando SHA-256 como exemplo)
  generateHash(): string {
    if (this.hex === '') {
      this.hash = '';
    } else {
      this.hash = dupHashSHA256(this.hex, 'hex');
    }

    return this.hash;
  }

  // Validar hash
  isHashValid(): boolean {
    return this.hash === dupHashSHA256(this.content);
  }

  onContentChange() {
    this.generateHex();
    this.generateHash();
  }

  onHexChange() {
    this.generateContent();
    this.generateHash();
  }
}
