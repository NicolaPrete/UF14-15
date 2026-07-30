import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { StaffManager } from './staff-manager';

/**
 * AsyncValidator che verifica in tempo reale, mentre l'utente compila il campo,
 * che lo username scelto non sia già in uso da un altro operatore.
 *
 * @param staffManager servizio incaricato di interrogare il backend
 * @param usernameOriginale se valorizzato (form di modifica), non viene eseguita
 *        alcuna chiamata quando il valore coincide con lo username già assegnato
 */
export function usernameDisponibileValidator(
  staffManager: StaffManager,
  usernameOriginale?: string,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = (control.value ?? '').trim();

    if (!value || value === usernameOriginale) {
      return of(null);
    }

    // Piccolo debounce per evitare una chiamata ad ogni singolo tasto premuto.
    return timer(400).pipe(
      switchMap(() => staffManager.checkUsernameAvailability(value)),
      map((disponibile) => (disponibile ? null : { usernameNonDisponibile: true })),
      catchError(() => of(null)),
    );
  };
}
