import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { PatientManager } from './patient-manager';
import { environment } from '../../../environments/environment';
import { PazienteDimesso } from './Pazienti.model';

describe('PatientManager', () => {
  let service: PatientManager;
  let httpMock: HttpTestingController;

  const dimessoFittizio: PazienteDimesso = {
    braccialetto: 'BR-0001',
    nome: 'Mario',
    cognome: 'Rossi',
    dataOraIngresso: '2026-07-29T08:00:00.000Z',
    dataOraDimissione: '2026-07-29T10:30:00.000Z',
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

  it('inizialmente non ha nessun paziente dimesso caricato', () => {
    expect(service.dimessiUltime24h()).toEqual([]);
    expect(service.dimessiLoading()).toBe(false);
  });

  it('recupera i pazienti dimessi nelle ultime 24 ore', () => {
    service.fetchDimessiUltime24h();

    expect(service.dimessiLoading()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/admissions/reports/discharged`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'success', results: 1, data: [dimessoFittizio] });

    expect(service.dimessiLoading()).toBe(false);
    expect(service.dimessiUltime24h()).toEqual([dimessoFittizio]);
    expect(service.dimessiError()).toBeNull();
  });

  it('gestisce correttamente un errore nel recupero dei dimessi', () => {
    service.fetchDimessiUltime24h();

    const req = httpMock.expectOne(`${environment.apiUrl}/admissions/reports/discharged`);
    req.flush(
      { status: 'fail', message: 'Errore interno' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(service.dimessiLoading()).toBe(false);
    expect(service.dimessiUltime24h()).toEqual([]);
    expect(service.dimessiError()).toBe('Errore interno');
  });
});
