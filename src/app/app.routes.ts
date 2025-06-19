import { Routes } from '@angular/router';
import { NetworkOverviewComponent } from './components/network/network-overview/network-overview.component';
import { AddressDetailsComponent } from './components/network/wallet/address-list/address-details.component';
import { MinerProfileComponent } from './components/profile/miner-profile/miner-profile.component';
import { MinerExistsGuard } from './guards/miner-exists.guard';
import { RootLayout } from './layouts/root.layout';

export const routes: Routes = [
  {
    path: '',
    component: RootLayout,
    children: [
      { path: '', component: NetworkOverviewComponent },
      {
        path: 'miners/:id',
        component: MinerProfileComponent,
        canActivate: [MinerExistsGuard],
      },
      {
        path: 'miners/:id/addresses/:address',
        component: AddressDetailsComponent,
        canActivate: [MinerExistsGuard],
      },
    ],
  },
];
