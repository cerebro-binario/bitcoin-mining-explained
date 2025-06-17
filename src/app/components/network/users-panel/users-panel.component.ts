import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { User } from '../../../models/user.model';
import { BitcoinNetworkService } from '../../../services/bitcoin-network.service';
import { UserComponent } from './user/user.component';

@Component({
  selector: 'app-users-panel',
  standalone: true,
  imports: [CommonModule, ButtonModule, FormsModule, UserComponent],
  templateUrl: './users-panel.component.html',
})
export class UsersPanelComponent {
  users: User[] = [];
  selectedUser: User | null = null;

  constructor(private networkService: BitcoinNetworkService) {
    this.networkService.nodes$.pipe(takeUntilDestroyed()).subscribe((nodes) => {
      this.users = nodes.filter((n) => n.nodeType === 'user');
      if (this.users.length > 0 && !this.selectedUser) {
        this.selectedUser = this.users[0];
      }
    });
  }

  createUser() {
    const user = this.networkService.addNode('user');
    user.name = `Usuário #${user.id}`;
    this.selectedUser = user;
  }

  selectUser(user: User) {
    this.selectedUser = user;
  }
}
