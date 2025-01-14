import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private themeKey = 'theme';
  private darkModeClass = 'dark';

  constructor() {}

  get darkMode() {
    return this.getTheme() === 'dark';
  }

  applyTheme(theme: 'dark' | 'light'): void {
    const element = document.querySelector('html');

    if (theme === 'dark') {
      element?.classList.add(this.darkModeClass);
    } else {
      element?.classList.remove(this.darkModeClass);
    }

    element?.setAttribute('data-p-color-scheme', theme);
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
