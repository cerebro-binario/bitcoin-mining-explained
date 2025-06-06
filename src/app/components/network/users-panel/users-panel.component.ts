import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { UserComponent } from './user/user.component';
import { User, UserWallet } from '../../../models/user.model';

@Component({
  selector: 'app-users-panel',
  standalone: true,
  imports: [CommonModule, ButtonModule, FormsModule, UserComponent],
  templateUrl: './users-panel.component.html',
})
export class UsersPanelComponent {
  users: User[] = [];
  selectedUser: User | null = null;
  userCount = 1;

  createUser() {
    const id = this.userCount;
    const name = `Usuário #${this.userCount++}`;
    const wallet: UserWallet = {
      step: 'choose',
      seed: [],
      seedPassphrase: '',
      passphrase: '',
      addresses: {
        bip44: [],
        bip49: [],
        bip84: [],
      },
    };
    this.users.push({ id, name, wallet });
    this.selectedUser = this.users[this.users.length - 1];
  }

  selectUser(user: User) {
    this.selectedUser = user;
  }
}
