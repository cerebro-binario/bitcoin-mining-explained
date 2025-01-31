import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { dupHashSHA256, hexToText, textToHex } from '../../../utils/tools';
import { HashTargetBarComponent } from './hash-target-bar/hash-target-bar.component';

@Component({
  selector: 'app-hash-target',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    IftaLabelModule,
    TextareaModule,
    MessageModule,
    HashTargetBarComponent,
  ],
  templateUrl: './hash-target.component.html',
  styleUrl: './hash-target.component.scss',
})
export class HashTargetComponent {
  content: string = ''; // Conteúdo do textarea
  hex: string = '';
  hash: string = '';

  target: string = '';

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

  onContentChange() {
    this.generateHex();
    this.generateHash();
  }

  onHexChange() {
    this.generateContent();
    this.generateHash();
  }

  isHashBelowTarget(): boolean {
    // Remove o prefixo '0x' se existir no hash ou target
    const cleanHash = this.hash.startsWith('0x')
      ? this.hash.slice(2)
      : this.hash;
    const cleanTarget = this.target.startsWith('0x')
      ? this.target.slice(2)
      : this.target;

    // Converte o hash e o target para BigInt
    const hashValue = BigInt(`0x${cleanHash}`);
    const targetValue = BigInt(`0x${cleanTarget}`);

    // Retorna true se o hash estiver abaixo do target
    return hashValue < targetValue;
  }
}
