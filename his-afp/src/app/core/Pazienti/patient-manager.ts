import { inject, Injectable, signal } from '@angular/core';
import { PatientAdmission, PatientAdmissionRes, Paziente, PazienteDimesso, PazienteDTO } from './Pazienti.model';
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

  // Stato del report "Monitor Dimessi (Ultime 24h)" - Task 3
  readonly #dimessiUltime24h = signal<PazienteDimesso[]>([]);
  dimessiUltime24h = this.#dimessiUltime24h.asReadonly();
  readonly #dimessiLoading = signal<boolean>(false);
  dimessiLoading = this.#dimessiLoading.asReadonly();
  readonly #dimessiError = signal<string | null>(null);
  dimessiError = this.#dimessiError.asReadonly();

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
   * Recupera i pazienti dimessi (stato DIM) nelle ultime 24 ore, per il
   * report di sola consultazione "Monitor Dimessi".
   */
  public fetchDimessiUltime24h() {
    this.#dimessiLoading.set(true);
    this.#dimessiError.set(null);

    this.#http
      .get<APIResponse<PazienteDimesso[]>>(`${environment.apiUrl}/admissions/reports/discharged`)
      .subscribe({
        next: (res) => {
          this.#dimessiUltime24h.set(res.data);
          this.#dimessiLoading.set(false);
        },
        error: (err) => {
          console.error('Errore durante il fetch dei pazienti dimessi:', err);
          this.#dimessiUltime24h.set([]);
          this.#dimessiLoading.set(false);
          this.#dimessiError.set(
            err.error?.message ?? 'Errore durante il recupero dei pazienti dimessi.',
          );
        },
      });
  }
}
