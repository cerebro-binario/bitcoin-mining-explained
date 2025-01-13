import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TabsModule } from 'primeng/tabs';

@Component({
  selector: 'app-home',
  imports: [TabsModule, RouterModule],
  templateUrl: './home.layout.html',
  styleUrl: './home.layout.scss',
})
export class HomeLayout {
  tabs = [
    { route: '/blockchain', icon: 'pi pi-home', label: 'Blockchain' },
    {
      route: '/mempool',
      icon: 'pi pi-arrow-right-arrow-left',
      label: 'Mempool',
    },
    {
      route: '/addresses',
      icon: 'pi pi-wallet',
      label: 'Endereços',
    },
  ];

  selectedTab = '/blockchain';

  constructor(private router: Router) {
    const url = this.router.url;

    this.selectedTab =
      this.tabs.find((t) => url.includes(t.route))?.route || '/blockchain';
  }
}
