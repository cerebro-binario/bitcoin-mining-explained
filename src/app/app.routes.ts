import { Routes } from '@angular/router';
import { BlockchainComponent } from './components/blockchain/blockchain.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: BlockchainComponent },
];
