import { Routes } from '@angular/router';
import { NetworkComponent } from './components/network/network.component';
import { MinerProfileComponent } from './components/profile/miner-profile/miner-profile.component';
import { ToolsComponent } from './components/tools/tools.component';
import { AddressesLayout } from './layouts/home/addresses/addresses.layout';
import { HomeLayout } from './layouts/home/home.layout';
import { MempoolLayout } from './layouts/home/mempool/mempool.layout';
import { NetworkLayout } from './layouts/home/network/network.layout';
import { ToolsLayout } from './layouts/home/tools/tools.layout';
import { ProfilePageLayout } from './layouts/profile-page.layout';
import { MainDashboardComponent } from './components/profile/main-dashboard/main-dashboard.component';
import { MinersListV2Component } from './components/profile/miners-list-v2/miners-list-v2.component';
import { NetworkOverviewComponent } from './components/network/network-overview/network-overview.component';
import { AddressDetailsComponent } from './components/network/wallet/address-list/address-details.component';
import { MinerExistsGuard } from './guards/miner-exists.guard';
import { V2Layout } from './layouts/v2.layout';

export const routes: Routes = [
  {
    path: 'dashboard',
    component: MainDashboardComponent,
  },
  {
    path: 'miner/:id',
    component: ProfilePageLayout,
    canActivate: [MinerExistsGuard],
    children: [
      { path: '', component: MinerProfileComponent },
      { path: 'addresses/:address', component: AddressDetailsComponent },
    ],
  },
  {
    path: 'dashboard/miners',
    component: MinersListV2Component,
  },
  {
    path: 'v2',
    component: V2Layout,
    children: [
      // Aqui ficarão as rotas filhas do v2
    ],
  },
  {
    path: '',
    component: HomeLayout,
    children: [
      {
        path: 'network',
        component: NetworkLayout,
        children: [
          { path: '', component: NetworkComponent },
          { path: 'miners', component: MinersListV2Component },
          { path: 'overview', component: NetworkOverviewComponent },
          // { path: 'nodes', component: NodesListV2Component },
          // { path: 'users', component: UsersListV2Component },
        ],
      },
      {
        path: 'mempool',
        component: MempoolLayout,
        children: [],
      },
      {
        path: 'addresses',
        component: AddressesLayout,
        children: [],
      },
      {
        path: 'tools',
        component: ToolsLayout,
        children: [{ path: '', pathMatch: 'full', component: ToolsComponent }],
      },
      { path: '', pathMatch: 'full', redirectTo: '/network' },
    ],
  },
];
