import { Routes } from '@angular/router';
import { RootLayout } from './layouts/root.layout';
import { MainLayoutComponent } from './layouts/main-layout.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { NetworkOverviewComponent } from './components/network/network-overview/network-overview.component';
import { MinerProfileComponent } from './components/profile/miner-profile/miner-profile.component';
import { PeerProfileComponent } from './components/profile/peer-profile/peer-profile.component';
import { UserProfileComponent } from './components/profile/user-profile/user-profile.component';
import { AddressDetailsComponent } from './components/network/wallet/address-list/address-details.component';
import { NodeExistsGuard } from './guards/miner-exists.guard';
import { GlobalConsensusPageComponent } from './pages/global-consensus-page.component';

export const routes: Routes = [
  {
    path: '',
    component: RootLayout,
    children: [
      {
        path: '',
        component: MainLayoutComponent,
        children: [
          { path: '', component: HomePageComponent },
          { path: 'miners/:id', component: MinerProfileComponent },
          { path: 'peers/:id', component: PeerProfileComponent },
          { path: 'users/:id', component: UserProfileComponent },
          { path: 'global-consensus', component: GlobalConsensusPageComponent },
        ],
      },
      { path: 'network', component: NetworkOverviewComponent },
      {
        path: 'miners/:id/addresses/:address',
        component: AddressDetailsComponent,
        canActivate: [NodeExistsGuard],
      },
      {
        path: 'peers/:id/addresses/:address',
        component: AddressDetailsComponent,
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
