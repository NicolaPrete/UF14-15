import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormAccettazionePz } from './form-accettazione-pz';
import { PazienteAnagrafica } from '../../../core/Pazienti/Pazienti.model';

describe('FormAccettazionePz', () => {
  let component: FormAccettazionePz;
  let fixture: ComponentFixture<FormAccettazionePz>;

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
      imports: [FormAccettazionePz],
    }).compileComponents();

    fixture = TestBed.createComponent(FormAccettazionePz);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('precompila e blocca i dati anagrafici quando arriva un paziente trovato', async () => {
    fixture.componentRef.setInput('pazienteTrovato', pazienteFittizio);
    fixture.detectChanges();
    await fixture.whenStable();

    const anagrafica = component.paziente.get('anagrafica');
    expect(anagrafica?.disabled).toBe(true);
    expect(anagrafica?.getRawValue()).toEqual({
      nome: 'Mario',
      cognome: 'Rossi',
      dataNascita: new Date('1980-01-01'),
      codiceFiscale: 'RSSMRA80A01H501U',
      sesso: 'M',
    });
  });

  it('lascia i dati anagrafici modificabili quando non c\'è nessun paziente trovato (nuovo paziente)', () => {
    const anagrafica = component.paziente.get('anagrafica');
    expect(anagrafica?.disabled).toBe(false);
  });
});
