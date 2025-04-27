import { Routes } from '@angular/router';
import { ToolsComponent } from './components/tools/tools.component';
import { AddressesLayout } from './layouts/home/addresses/addresses.layout';
import { BlockchainLayout } from './layouts/home/blockchain/blockchain.layout';
import { HomeLayout } from './layouts/home/home.layout';
import { MempoolLayout } from './layouts/home/mempool/mempool.layout';
import { ToolsLayout } from './layouts/home/tools/tools.layout';
import { BlockchainV2Component } from './components/blockchain-v2/blockchain-v2.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeLayout,
    children: [
      {
        path: 'blockchain',
        component: BlockchainLayout,
        children: [{ path: '', component: BlockchainV2Component }],
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
      { path: '', pathMatch: 'full', redirectTo: '/blockchain' },
    ],
  },
];
