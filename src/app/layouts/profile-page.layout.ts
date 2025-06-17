import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-profile-page-layout',
  templateUrl: './profile-page.layout.html',
  styleUrls: ['./profile-page.layout.scss'],
  imports: [RouterModule],
})
export class ProfilePageLayout {
  back() {
    window.history.back();
  }
}
