import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Dimessi24h } from './dimessi-24h';

describe('Dimessi24h', () => {
  let component: Dimessi24h;
  let fixture: ComponentFixture<Dimessi24h>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dimessi24h],
    }).compileComponents();

    fixture = TestBed.createComponent(Dimessi24h);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('richiede i pazienti dimessi al ngOnInit', () => {
    const spy = vi.spyOn(component.patientManager, 'fetchDimessiUltime24h').mockImplementation(() => {});
    fixture.detectChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('il pulsante "Aggiorna" richiama nuovamente il fetch', () => {
    const spy = vi.spyOn(component.patientManager, 'fetchDimessiUltime24h').mockImplementation(() => {});
    component.aggiorna();
    expect(spy).toHaveBeenCalled();
  });
});
