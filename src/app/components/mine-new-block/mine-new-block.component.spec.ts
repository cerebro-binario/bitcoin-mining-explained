import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MineNewBlockComponent } from './mine-new-block.component';

describe('MineNewBlockComponent', () => {
  let component: MineNewBlockComponent;
  let fixture: ComponentFixture<MineNewBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MineNewBlockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MineNewBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
