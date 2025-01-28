import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { dupHashSHA256, hexToText, textToHex } from '../../../utils/tools';

@Component({
  selector: 'app-hashes-compared',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    IftaLabelModule,
    TextareaModule,
    MessageModule,
  ],
  templateUrl: './hashes-compared.component.html',
  styleUrl: './hashes-compared.component.scss',
})
export class HashesComparedComponent {
  content: string = ''; // Conteúdo do textarea
  hex: string = '';
  hash: string = '';

  compare: string = ''; // Conteúdo do textarea
  compareHex: string = '';
  compareHash: string = '';

  generateContent(): string {
    this.content = hexToText(this.hex);
    return this.content;
  }

  generateCompare(): string {
    this.compare = hexToText(this.hex);
    return this.compare;
  }

  generateHex(): string {
    this.hex = textToHex(this.content);
    return this.hex;
  }

  generateCompareHex(): string {
    this.compareHex = textToHex(this.compare);
    return this.compareHex;
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

  generateCompareHash(): string {
    if (this.compareHex === '') {
      this.compareHash = '';
    } else {
      this.compareHash = dupHashSHA256(this.compareHex, 'hex');
    }

    return this.compareHash;
  }

  onContentChange() {
    this.generateHex();
    this.generateHash();
  }

  onHexChange() {
    this.generateContent();
    this.generateHash();
  }

  onCompareChange() {
    this.generateCompareHex();
    this.generateCompareHash();
  }

  onCompareHexChange() {
    this.generateCompare();
    this.generateCompareHash();
  }

  areHashesEqual() {
    return this.hash && this.compareHash && this.hash === this.compareHash;
  }
}
