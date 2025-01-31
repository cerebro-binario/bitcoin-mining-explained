import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HashTargetComponent } from './hash-target.component';

describe('TargetDifficultyComponent', () => {
  let component: HashTargetComponent;
  let fixture: ComponentFixture<HashTargetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HashTargetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HashTargetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
