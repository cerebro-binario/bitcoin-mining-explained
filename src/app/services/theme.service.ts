import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private themeKey = 'theme';

  constructor() {}

  applyTheme(theme: 'dark' | 'light'): void {
    document.documentElement.setAttribute('data-p-color-scheme', theme);
    localStorage.setItem(this.themeKey, theme);
  }

  getTheme(): 'dark' | 'light' {
    return (localStorage.getItem(this.themeKey) as 'dark' | 'light') || 'dark';
  }

  toggleTheme(): void {
    const currentTheme = this.getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }
}
