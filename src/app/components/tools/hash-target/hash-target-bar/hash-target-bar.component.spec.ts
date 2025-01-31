import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HashTargetBarComponent } from './hash-target-bar.component';

describe('HashTargetBarComponent', () => {
  let component: HashTargetBarComponent;
  let fixture: ComponentFixture<HashTargetBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HashTargetBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HashTargetBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
