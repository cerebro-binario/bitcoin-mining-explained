import { Component } from '@angular/core';

@Component({
  selector: 'app-profile-page-layout',
  templateUrl: './profile-page.layout.html',
  styleUrls: ['./profile-page.layout.scss'],
})
export class ProfilePageLayout {
  back() {
    window.history.back();
  }
}
