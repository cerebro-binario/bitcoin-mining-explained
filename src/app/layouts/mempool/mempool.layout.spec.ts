import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MempoolLayout } from './mempool.layout';

describe('MempoolLayout', () => {
  let component: MempoolLayout;
  let fixture: ComponentFixture<MempoolLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MempoolLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MempoolLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
