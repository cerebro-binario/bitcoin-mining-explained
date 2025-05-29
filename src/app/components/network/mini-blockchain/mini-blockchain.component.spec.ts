import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiniBlockchainComponent } from './mini-blockchain.component';

describe('MiniBlockchainComponent', () => {
  let component: MiniBlockchainComponent;
  let fixture: ComponentFixture<MiniBlockchainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiniBlockchainComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiniBlockchainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
