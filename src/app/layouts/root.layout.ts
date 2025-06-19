import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-root-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <router-outlet></router-outlet>
    </div>
  `,
})
export class RootLayout {
  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    const theme = this.themeService.getTheme();
    this.themeService.applyTheme(theme);
  }
}
