import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockchainLayout } from './blockchain.layout';

describe('BlockchainLayout', () => {
  let component: BlockchainLayout;
  let fixture: ComponentFixture<BlockchainLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockchainLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlockchainLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
