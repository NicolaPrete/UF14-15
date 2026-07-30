import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { PatientManager } from './patient-manager';
import { environment } from '../../../environments/environment';
import { PazienteAnagraficaDTO } from './Pazienti.model';

describe('PatientManager', () => {
  let service: PatientManager;
  let httpMock: HttpTestingController;

  const dtoFittizio: PazienteAnagraficaDTO = {
    id: 1,
    codice_fiscale: 'RSSMRA80A01H501U',
    nome: 'MARIO',
    cognome: 'ROSSI',
    data_nascita: '1980-01-01',
    sex: 'M',
    indirizzo_via: null,
    indirizzo_civico: null,
    comune: null,
    provincia: null,
    created_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PatientManager);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('inizialmente non ha eseguito nessuna ricerca', () => {
    expect(service.ricercaEseguita()).toBe(false);
    expect(service.risultatiRicerca()).toEqual([]);
  });

  it('cerca per Codice Fiscale e mappa i risultati in camelCase', () => {
    service.cercaPerCodiceFiscale('RSSMRA80A01H501U');

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/patients/search` && r.params.get('cf') === 'RSSMRA80A01H501U',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'success', data: [dtoFittizio] });

    expect(service.ricercaEseguita()).toBe(true);
    expect(service.risultatiRicerca()).toEqual([
      {
        id: 1,
        codiceFiscale: 'RSSMRA80A01H501U',
        nome: 'MARIO',
        cognome: 'ROSSI',
        dataNascita: '1980-01-01',
        sesso: 'M',
        indirizzoVia: null,
        indirizzoCivico: null,
        comune: null,
        provincia: null,
      },
    ]);
  });

  it('cerca per Nome, Cognome e Data di Nascita', () => {
    service.cercaPerAnagrafica('Mario', 'Rossi', '1980-01-01');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/patients/search` &&
        r.params.get('nome') === 'Mario' &&
        r.params.get('cognome') === 'Rossi' &&
        r.params.get('data_nascita') === '1980-01-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'success', data: [] });

    expect(service.ricercaEseguita()).toBe(true);
    expect(service.risultatiRicerca()).toEqual([]);
  });

  it('gestisce correttamente un errore di ricerca', () => {
    service.cercaPerCodiceFiscale('XXXXXX00X00X000X');

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/patients/search`,
    );
    req.flush(
      { status: 'fail', message: 'Paziente non trovato' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(service.ricercaEseguita()).toBe(true);
    expect(service.risultatiRicerca()).toEqual([]);
    expect(service.erroreRicerca()).toBe('Paziente non trovato');
  });

  it('resetRicerca azzera lo stato della ricerca', () => {
    service.cercaPerCodiceFiscale('RSSMRA80A01H501U');
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/patients/search`,
    );
    req.flush({ status: 'success', data: [dtoFittizio] });

    service.resetRicerca();

    expect(service.ricercaEseguita()).toBe(false);
    expect(service.risultatiRicerca()).toEqual([]);
    expect(service.erroreRicerca()).toBeNull();
  });
});
