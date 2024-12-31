import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, ToolbarModule, ButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'bitcoin-mining-explained';

  darkMode = false;

  get darkModeIcon() {
    return (this.darkMode && 'pi pi-sun') || 'pi pi-moon';
  }

  toggleDarkMode() {
    const element = document.querySelector('html');
    element?.classList.toggle('my-app-dark');

    this.darkMode = element?.classList.contains('my-app-dark') || false;
  }
}
