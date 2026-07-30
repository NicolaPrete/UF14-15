import { inject, Injectable, signal } from '@angular/core';
import {
  CriteriRicercaAnagrafica,
  CriteriRicercaCF,
  PatientAdmission,
  PatientAdmissionRes,
  Paziente,
  PazienteAnagrafica,
  PazienteAnagraficaDTO,
  PazienteDTO,
} from './Pazienti.model';
import { HttpClient } from '@angular/common/http';
import { APIResponse } from '../models/APIResponse.model';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class PatientManager {
  timer_id = signal<number>(-1);
  #http = inject(HttpClient);
  readonly #router = inject(Router);
  #listaPZ = signal<Paziente[]>([]);
  #listaPZFiltered = signal<Paziente[]>(this.#listaPZ());
  listaPZ = this.#listaPZFiltered.asReadonly();

  // Stato della ricerca anagrafica (Task 2 - Workflow Ricerca e Accettazione Avanzata)
  readonly #risultatiRicerca = signal<PazienteAnagrafica[]>([]);
  risultatiRicerca = this.#risultatiRicerca.asReadonly();
  readonly #ricercaEseguita = signal<boolean>(false);
  ricercaEseguita = this.#ricercaEseguita.asReadonly();
  readonly #ricercaInCorso = signal<boolean>(false);
  ricercaInCorso = this.#ricercaInCorso.asReadonly();
  readonly #erroreRicerca = signal<string | null>(null);
  erroreRicerca = this.#erroreRicerca.asReadonly();

  // constructor() {
  //   this.fetchPazienti();
  // }

  /**
   * Creazione timer di t secondi
   */
  public refreshPazienti() {
    if (this.timer_id() >= 0) return;
    let id = setInterval(() => this.fetchPazienti(), 1000);
    this.timer_id.set(id);
  }

  public stopRefreshPazienti() {
    clearInterval(this.timer_id());
    this.timer_id.set(-1);
  }

  public fetchPazienti() {
    this.#http.get<APIResponse<PazienteDTO[]>>(`/api/admissions`).subscribe({
      next: (res) => {
        const pz = res.data.map((p) => this.mapPazienteDTOToPaziente(p));
        this.#listaPZ.set(pz);
      },
      error: (err) => {
        console.error('Errore durante il fetch dei pazienti:', err);
      },
    });
  }

  public admitPatient(pz: PatientAdmission) {
    this.#http
      .post<APIResponse<PatientAdmissionRes>>(`${environment.apiUrl}/admissions`, pz)
      .subscribe({
        next: (res) => {
          this.#router.navigate([`/modifica-pz/${res.data.id}`]);
        },
        error: (err) => {
          console.error("Errore durante l'ammissione del paziente:", err);
        },
      });
  }

  public updatePatientInfo(pzId: number, residenza: Pick<PatientAdmission, 'residenza'>) {
    this.#http
      .patch<APIResponse<PatientAdmissionRes>>(`${environment.apiUrl}/patients/${pzId}`, residenza)
      .subscribe({
        next: (res) => {
          this.#router.navigate([`/lista-pz`]);
        },
        error: (err) => {
          console.error("Errore durante l'aggiornamento delle informazioni del paziente:", err);
        },
      });
  }

  public mapPazienteDTOToPaziente(pz: PazienteDTO): Paziente {
    return {
      id: pz.id.toString(),
      nome: pz.nome,
      cognome: pz.cognome,
      braccialetto: pz.braccialetto,
      codiceColore: pz.coloreCode,
      note: pz.noteTriage,
      patologia: pz.patologiaCode,
      eta: this.calcolaEta(pz.dataNascita),
    };
  }

  public calcolaEta(dataNascita: string): number {
    const today = new Date();
    const birthDate = new Date(dataNascita);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  public filterByName(name: string) {
    const filtered = this.#listaPZ().filter((p) => {
      const fullName = `${p.nome} ${p.cognome}`.toLowerCase();
      return fullName.includes(name.toLowerCase());
    });
    this.#listaPZFiltered.set(filtered);
  }

  /**
   * Ricerca un paziente in anagrafica tramite Codice Fiscale (ricerca esatta).
   */
  public cercaPerCodiceFiscale(codiceFiscale: string) {
    this.eseguiRicercaPazienti({ cf: codiceFiscale });
  }

  /**
   * Ricerca un paziente in anagrafica tramite Nome, Cognome e Data di nascita.
   * dataNascita deve essere in formato ISO (yyyy-mm-dd).
   */
  public cercaPerAnagrafica(nome: string, cognome: string, dataNascita: string) {
    this.eseguiRicercaPazienti({ nome, cognome, data_nascita: dataNascita });
  }

  /**
   * Azzera lo stato della ricerca (es. quando si cambia modalità o si seleziona "Nuovo Paziente").
   */
  public resetRicerca() {
    this.#risultatiRicerca.set([]);
    this.#ricercaEseguita.set(false);
    this.#erroreRicerca.set(null);
  }

  private eseguiRicercaPazienti(criteri: CriteriRicercaCF | CriteriRicercaAnagrafica) {
    this.#ricercaInCorso.set(true);
    this.#erroreRicerca.set(null);

    this.#http
      .get<APIResponse<PazienteAnagraficaDTO[]>>(`${environment.apiUrl}/patients/search`, {
        params: { ...criteri },
      })
      .subscribe({
        next: (res) => {
          this.#risultatiRicerca.set(
            res.data.map((p) => this.mapPazienteAnagraficaDTOToPazienteAnagrafica(p)),
          );
          this.#ricercaEseguita.set(true);
          this.#ricercaInCorso.set(false);
        },
        error: (err) => {
          console.error('Errore durante la ricerca del paziente:', err);
          this.#risultatiRicerca.set([]);
          this.#ricercaEseguita.set(true);
          this.#ricercaInCorso.set(false);
          this.#erroreRicerca.set(
            err.error?.message ?? 'Errore durante la ricerca del paziente.',
          );
        },
      });
  }

  public mapPazienteAnagraficaDTOToPazienteAnagrafica(
    pz: PazienteAnagraficaDTO,
  ): PazienteAnagrafica {
    return {
      id: pz.id,
      codiceFiscale: pz.codice_fiscale,
      nome: pz.nome,
      cognome: pz.cognome,
      dataNascita: pz.data_nascita,
      sesso: pz.sex,
      indirizzoVia: pz.indirizzo_via,
      indirizzoCivico: pz.indirizzo_civico,
      comune: pz.comune,
      provincia: pz.provincia,
    };
  }
}
