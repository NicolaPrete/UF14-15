import { FormControl, ValidationErrors } from '@angular/forms';
import { firstValueFrom, Observable, of } from 'rxjs';
import { usernameDisponibileValidator } from './username-disponibile.validator';
import { StaffManager } from './staff-manager';

/**
 * Il tipo AsyncValidatorFn ammette come ritorno sia Observable che Promise;
 * la nostra implementazione restituisce sempre un Observable, quindi
 * effettuiamo un cast esplicito e tipizzato (nessun `any`) per poterlo
 * consumare con firstValueFrom nei test.
 */
function eseguiValidator(
  validatorResult: ReturnType<ReturnType<typeof usernameDisponibileValidator>>,
): Promise<ValidationErrors | null> {
  return firstValueFrom(validatorResult as Observable<ValidationErrors | null>);
}

describe('usernameDisponibileValidator', () => {
  function mockStaffManager(available: boolean): StaffManager {
    return {
      checkUsernameAvailability: () => of(available),
    } as unknown as StaffManager;
  }

  it('non effettua alcuna chiamata se il campo è vuoto', async () => {
    const staffManager = mockStaffManager(true);
    const validator = usernameDisponibileValidator(staffManager);
    const result = await eseguiValidator(validator(new FormControl('')));
    expect(result).toBeNull();
  });

  it('non effettua alcuna chiamata se il valore coincide con lo username originale (modifica)', async () => {
    const staffManager = mockStaffManager(false);
    const validator = usernameDisponibileValidator(staffManager, 'mrossi');
    const result = await eseguiValidator(validator(new FormControl('mrossi')));
    expect(result).toBeNull();
  });

  it('restituisce null quando lo username è disponibile', async () => {
    const staffManager = mockStaffManager(true);
    const validator = usernameDisponibileValidator(staffManager);
    const result = await eseguiValidator(validator(new FormControl('nuovo.utente')));
    expect(result).toBeNull();
  });

  it('restituisce un errore quando lo username è già in uso', async () => {
    const staffManager = mockStaffManager(false);
    const validator = usernameDisponibileValidator(staffManager);
    const result = await eseguiValidator(validator(new FormControl('mrossi')));
    expect(result).toEqual({ usernameNonDisponibile: true });
  });
});
