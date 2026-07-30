import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RicercaPz } from './ricerca-pz';
import { PazienteAnagrafica } from '../../../core/Pazienti/Pazienti.model';

describe('RicercaPz', () => {
  let component: RicercaPz;
  let fixture: ComponentFixture<RicercaPz>;

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
      imports: [RicercaPz],
    }).compileComponents();

    fixture = TestBed.createComponent(RicercaPz);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('parte in modalità di ricerca per Codice Fiscale', () => {
    expect(component.modalita()).toBe('cf');
  });

  it('non effettua la ricerca se il form del codice fiscale non è valido', () => {
    const spy = vi.spyOn(component.patientManager, 'cercaPerCodiceFiscale').mockImplementation(() => {});
    component.cercaPerCodiceFiscale();
    expect(spy).not.toHaveBeenCalled();
  });

  it('effettua la ricerca per codice fiscale (in maiuscolo) quando il form è valido', () => {
    const spy = vi.spyOn(component.patientManager, 'cercaPerCodiceFiscale').mockImplementation(() => {});
    component.ricercaCfForm.setValue({ codiceFiscale: 'rssmra80a01h501u' });
    component.cercaPerCodiceFiscale();
    expect(spy).toHaveBeenCalledWith('RSSMRA80A01H501U');
  });

  it('emette il paziente selezionato', () => {
    let emesso: PazienteAnagrafica | undefined;
    component.pazienteSelezionato.subscribe((pz) => (emesso = pz));
    component.selezionaPaziente(pazienteFittizio);
    expect(emesso).toEqual(pazienteFittizio);
  });

  it('emette l\'evento "nuovo paziente" e resetta la ricerca', () => {
    const resetSpy = vi.spyOn(component.patientManager, 'resetRicerca').mockImplementation(() => {});
    let emesso = false;
    component.nuovoPaziente.subscribe(() => (emesso = true));
    component.segnalaNuovoPaziente();
    expect(emesso).toBe(true);
    expect(resetSpy).toHaveBeenCalled();
  });
});
