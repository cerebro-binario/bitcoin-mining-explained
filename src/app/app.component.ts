import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, ToolbarModule, ButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'bitcoin-mining-explained';

  constructor(private themeService: ThemeService) {}

  get darkModeIcon() {
    return (this.themeService.darkMode && 'pi pi-sun') || 'pi pi-moon';
  }

  ngOnInit(): void {
    const theme = this.themeService.getTheme();
    this.themeService.applyTheme(theme);
  }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }
}
