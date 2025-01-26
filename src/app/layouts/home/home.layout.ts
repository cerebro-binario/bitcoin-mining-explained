import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { ToolbarModule } from 'primeng/toolbar';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    MenubarModule,
    RouterModule,
    ToolbarModule,
    ButtonModule,
  ],
  templateUrl: './home.layout.html',
  styleUrl: './home.layout.scss',
})
export class HomeLayout {
  tabs = [
    { route: '/blockchain', icon: 'pi pi-home', label: 'Blockchain' },
    {
      route: '/mempool',
      icon: 'pi pi-arrow-right-arrow-left',
      label: 'Transações',
    },
    {
      route: '/addresses',
      icon: 'pi pi-wallet',
      label: 'Endereços',
    },
    {
      route: '/tools',
      icon: 'pi pi-wrench',
      label: 'Ferramentas',
    },
  ];

  selectedTab = '/blockchain';

  constructor(private router: Router, private themeService: ThemeService) {
    const url = this.router.url;

    this.selectedTab =
      this.tabs.find((t) => url.includes(t.route))?.route || '/blockchain';
  }

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
