import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HashesComparedComponent } from './hashes-compared.component';

describe('HashesComparedComponent', () => {
  let component: HashesComparedComponent;
  let fixture: ComponentFixture<HashesComparedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HashesComparedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HashesComparedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
