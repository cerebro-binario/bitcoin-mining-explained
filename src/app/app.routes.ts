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

export const routes: Routes = [
  {
    path: 'dashboard',
    component: MainDashboardComponent,
  },
  {
    path: 'miner/:id',
    component: ProfilePageLayout,
    children: [{ path: '', component: MinerProfileComponent }],
  },
  {
    path: 'dashboard/miners',
    component: MinersListV2Component,
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
