import { Routes } from '@angular/router';
import { NetworkOverviewComponent } from './components/network/network-overview/network-overview.component';
import { AddressDetailsComponent } from './components/network/wallet/address-list/address-details.component';
import { MinerProfileComponent } from './components/profile/miner-profile/miner-profile.component';
import { PeerProfileComponent } from './components/profile/peer-profile/peer-profile.component';
import { UserProfileComponent } from './components/profile/user-profile/user-profile.component';
import { NodeExistsGuard } from './guards/miner-exists.guard';
import { RootLayout } from './layouts/root.layout';
import { HomePageComponent } from './pages/home-page/home-page.component';

export const routes: Routes = [
  {
    path: '',
    component: RootLayout,
    children: [
      { path: '', component: HomePageComponent },
      { path: 'network', component: NetworkOverviewComponent },
      {
        path: 'miners/:id',
        component: MinerProfileComponent,
        canActivate: [NodeExistsGuard],
      },
      {
        path: 'miners/:id/addresses/:address',
        component: AddressDetailsComponent,
        canActivate: [NodeExistsGuard],
      },
      {
        path: 'peers/:id',
        component: PeerProfileComponent,
        canActivate: [NodeExistsGuard],
      },
      {
        path: 'peers/:id/addresses/:address',
        component: AddressDetailsComponent,
        canActivate: [NodeExistsGuard],
      },
      {
        path: 'users/:id',
        component: UserProfileComponent,
        canActivate: [NodeExistsGuard],
      },
      {
        path: 'miners/:id/blocks/:height/:hash',
        loadComponent: () =>
          import('./components/network/blockchain/block-details.page').then(
            (m) => m.BlockDetailsPage
          ),
        canActivate: [NodeExistsGuard],
      },
    ],
  },
];
