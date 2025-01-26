import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolsLayout } from './tools.layout';

describe('ToolsLayout', () => {
  let component: ToolsLayout;
  let fixture: ComponentFixture<ToolsLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolsLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToolsLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
