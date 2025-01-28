import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { TextareaModule } from 'primeng/textarea';
import { dupHashSHA256, hexToText, textToHex } from '../../utils/tools';

@Component({
  selector: 'app-tools',
  imports: [
    CommonModule,
    FormsModule,
    PanelModule,
    InputTextModule,
    TextareaModule,
    IftaLabelModule,
    CardModule,
    MessageModule,
  ],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss',
})
export class ToolsComponent {
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

  // Copia o hash para a área de transferência
  copyHash(): void {
    const hash = dupHashSHA256(this.content);
    navigator.clipboard.writeText(hash).then(() => {
      alert('Hash copiado para a área de transferência!');
    });
  }

  // Limpa o conteúdo
  clearContent(): void {
    this.content = '';
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
