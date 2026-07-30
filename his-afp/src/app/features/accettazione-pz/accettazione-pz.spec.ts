import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccettazionePz } from './accettazione-pz';
import { PazienteAnagrafica } from '../../core/Pazienti/Pazienti.model';

describe('AccettazionePz', () => {
  let component: AccettazionePz;
  let fixture: ComponentFixture<AccettazionePz>;

  const pazienteFittizio: PazienteAnagrafica = {
    id: 1,
    codiceFiscale: 'RSSMRA80A01H501U',
    nome: 'Mario',
    cognome: 'Rossi',
    dataNascita: '1980-01-01',
    sesso: 'M',
    indirizzoVia: null,
    indirizzoCivico: null,
    comune: null,
    provincia: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccettazionePz],
    }).compileComponents();

    fixture = TestBed.createComponent(AccettazionePz);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('non mostra il form finché non viene fatta una ricerca o scelto "Nuovo Paziente"', () => {
    expect(component.mostraForm()).toBe(false);
  });

  it('mostra il form precompilato quando un paziente viene selezionato dalla ricerca', () => {
    component.onPazienteSelezionato(pazienteFittizio);
    expect(component.mostraForm()).toBe(true);
    expect(component.pazienteTrovato()).toEqual(pazienteFittizio);
  });

  it('mostra il form vuoto quando si sceglie "Nuovo Paziente"', () => {
    component.onPazienteSelezionato(pazienteFittizio);
    component.onNuovoPaziente();
    expect(component.mostraForm()).toBe(true);
    expect(component.pazienteTrovato()).toBeNull();
  });
});
