import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { APIResponse } from '../models/APIResponse.model';
import { NewStaff, Staff, UserRole, UsernameAvailability } from './staff.model';

@Injectable({
  providedIn: 'root',
})
export class StaffManager {
  readonly #http = inject(HttpClient);

  readonly #staffList = signal<Staff[]>([]);
  staffList = this.#staffList.asReadonly();

  readonly #loading = signal<boolean>(false);
  loading = this.#loading.asReadonly();

  /**
   * Recupera l'elenco completo dello staff (attivo e disattivato).
   */
  public fetchStaff() {
    this.#loading.set(true);
    this.#http.get<APIResponse<Staff[]>>(`${environment.apiUrl}/users`).subscribe({
      next: (res) => {
        this.#staffList.set(res.data);
        this.#loading.set(false);
      },
      error: (err) => {
        console.error("Errore durante il fetch dell'elenco dello staff:", err);
        this.#loading.set(false);
      },
    });
  }

  /**
   * Verifica in tempo reale la disponibilità di uno username.
   * Utilizzato dall'AsyncValidator del form di creazione operatore.
   */
  public checkUsernameAvailability(username: string): Observable<boolean> {
    return this.#http
      .get<APIResponse<UsernameAvailability>>(
        `${environment.apiUrl}/users/check/${encodeURIComponent(username)}`,
      )
      .pipe(map((res) => res.data.available));
  }

  /**
   * Crea un nuovo operatore e aggiorna in maniera ottimistica la lista in memoria.
   */
  public createStaff(nuovoOperatore: NewStaff): Observable<APIResponse<Staff>> {
    return this.#http
      .post<APIResponse<Staff>>(`${environment.apiUrl}/users`, nuovoOperatore)
      .pipe(
        tap((res) => {
          const nuovo: Staff = { ...res.data, isActive: true };
          this.#staffList.update((list) =>
            [...list, nuovo].sort((a, b) => a.username.localeCompare(b.username)),
          );
        }),
      );
  }

  /**
   * Modifica il ruolo di un operatore esistente.
   */
  public editUserRole(id: number, role: UserRole): Observable<APIResponse<Staff>> {
    return this.#http
      .patch<APIResponse<Staff>>(`${environment.apiUrl}/users/${id}/editrole`, { role })
      .pipe(
        tap((res) => {
          this.#staffList.update((list) =>
            list.map((s) => (s.id === id ? { ...s, role: res.data.role } : s)),
          );
        }),
      );
  }

  /**
   * Attiva o disattiva un operatore (gestione accessi al sistema).
   */
  public setActivation(id: number, active: boolean): Observable<APIResponse<unknown>> {
    const url = `${environment.apiUrl}/users/${id}/${active ? 'activate' : 'deactivate'}`;
    return this.#http.patch<APIResponse<unknown>>(url, {}).pipe(
      tap(() => {
        this.#staffList.update((list) =>
          list.map((s) => (s.id === id ? { ...s, isActive: active } : s)),
        );
      }),
    );
  }
}
