import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
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
  tabs: MenuItem[] = [
    {
      label: 'Rede Bitcoin',
      icon: 'pi pi-home',
      items: [
        {
          label: 'Mineradores',
          icon: 'pi pi-server',
          routerLink: '/network/miners',
        },
        { label: 'Nós', icon: 'pi pi-sitemap', routerLink: '/network/nodes' },
        {
          label: 'Usuários',
          icon: 'pi pi-users',
          routerLink: '/network/users',
        },
      ],
    },
    {
      label: 'Ferramentas',
      icon: 'pi pi-wrench',
      routerLink: '/tools',
    },
  ];

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
