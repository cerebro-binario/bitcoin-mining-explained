import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiceAnalogyComponent } from './dice-analogy.component';

describe('DiceAnalogyComponent', () => {
  let component: DiceAnalogyComponent;
  let fixture: ComponentFixture<DiceAnalogyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiceAnalogyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiceAnalogyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
