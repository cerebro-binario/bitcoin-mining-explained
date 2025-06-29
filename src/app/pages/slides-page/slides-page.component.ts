import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-slides-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="slides-container">
      <div #slidesContent></div>
    </div>
  `,
  styles: [
    `
      .slides-container {
        width: 100%;
        height: 100vh;
        overflow: auto;
      }
    `,
  ],
})
export class SlidesPageComponent implements OnInit {
  @ViewChild('slidesContent', { static: true }) slidesContent!: ElementRef;

  ngOnInit() {
    this.loadSlides();
  }

  private async loadSlides() {
    try {
      const response = await fetch('/assets/slides.html');
      const htmlContent = await response.text();

      // Criar um elemento div temporário para inserir o HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Limpar o container e inserir o conteúdo
      this.slidesContent.nativeElement.innerHTML = '';
      this.slidesContent.nativeElement.appendChild(tempDiv);

      // Aplicar estilos globais se necessário
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'auto';
    } catch (error) {
      console.error('Erro ao carregar os slides:', error);
      this.slidesContent.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2>Erro ao carregar os slides</h2>
          <p>Não foi possível carregar o arquivo de slides.</p>
        </div>
      `;
    }
  }
}
