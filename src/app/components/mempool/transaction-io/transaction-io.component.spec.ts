import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionIoComponent } from './transaction-io.component';

describe('TransactionIoComponent', () => {
  let component: TransactionIoComponent;
  let fixture: ComponentFixture<TransactionIoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionIoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionIoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
