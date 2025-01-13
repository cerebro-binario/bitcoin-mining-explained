import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddressesLayout } from './addresses.layout';

describe('AddressesLayout', () => {
  let component: AddressesLayout;
  let fixture: ComponentFixture<AddressesLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddressesLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddressesLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
