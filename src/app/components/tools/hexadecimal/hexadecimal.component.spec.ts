import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HexadecimalComponent } from './hexadecimal.component';

describe('HexadecimalComponent', () => {
  let component: HexadecimalComponent;
  let fixture: ComponentFixture<HexadecimalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HexadecimalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HexadecimalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
