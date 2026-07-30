import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionePersonale } from './gestione-personale';

describe('GestionePersonale', () => {
  let component: GestionePersonale;
  let fixture: ComponentFixture<GestionePersonale>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionePersonale],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionePersonale);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
