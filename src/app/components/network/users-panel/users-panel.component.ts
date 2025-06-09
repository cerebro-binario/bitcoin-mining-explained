import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { UserComponent } from './user/user.component';
import { User, UserWallet } from '../../../models/user.model';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';

@Component({
  selector: 'app-users-panel',
  standalone: true,
  imports: [CommonModule, ButtonModule, FormsModule, UserComponent],
  templateUrl: './users-panel.component.html',
})
export class UsersPanelComponent implements OnInit {
  users: User[] = [];
  selectedUser: User | null = null;
  userCount = 1;

  constructor(private networkService: BitcoinNetworkService) {}

  ngOnInit() {
    this.networkService.users$.subscribe((users) => {
      this.users = users;
      if (users.length > 0 && !this.selectedUser) {
        this.selectedUser = users[0];
      }
    });
  }

  createUser() {
    const name = `Usuário #${this.userCount++}`;
    const user = this.networkService.addUser(name);
    const wallet: UserWallet = {
      step: 'choose',
      seed: [],
      seedPassphrase: '',
      passphrase: '',
      addresses: [],
    };
    user.wallet = wallet;
    this.networkService.updateUser(user);
    this.selectedUser = user;
  }

  selectUser(user: User) {
    this.selectedUser = user;
  }
}
