import { Routes } from '@angular/router';
import { AddressesComponent } from './components/addresses/addresses.component';
import { BlockchainComponent } from './components/blockchain/blockchain.component';
import { MempoolComponent } from './components/mempool/mempool.component';
import { NewTransactionComponent } from './components/mempool/new-transaction/new-transaction.component';
import { MineNewBlockComponent } from './components/mine-new-block/mine-new-block.component';
import { AddressesLayout } from './layouts/home/addresses/addresses.layout';
import { BlockchainLayout } from './layouts/home/blockchain/blockchain.layout';
import { HomeLayout } from './layouts/home/home.layout';
import { MempoolLayout } from './layouts/home/mempool/mempool.layout';

export const routes: Routes = [
  {
    path: '',
    component: HomeLayout,
    children: [
      {
        path: 'blockchain',
        component: BlockchainLayout,
        children: [
          { path: '', pathMatch: 'full', component: BlockchainComponent },
          { path: 'mine-new-block', component: MineNewBlockComponent },
        ],
      },
      {
        path: 'mempool',
        component: MempoolLayout,
        children: [
          { path: '', pathMatch: 'full', component: MempoolComponent },
          { path: 'new-transaction', component: NewTransactionComponent },
        ],
      },
      {
        path: 'addresses',
        component: AddressesLayout,
        children: [
          { path: '', pathMatch: 'full', component: AddressesComponent },
        ],
      },
      { path: '', pathMatch: 'full', redirectTo: '/blockchain' },
    ],
  },
];
