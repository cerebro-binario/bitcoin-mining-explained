import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BitcoinEmissionChartComponent } from './bitcoin-emission-chart.component';

describe('BitcoinEmissionChartComponent', () => {
  let component: BitcoinEmissionChartComponent;
  let fixture: ComponentFixture<BitcoinEmissionChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BitcoinEmissionChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BitcoinEmissionChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
