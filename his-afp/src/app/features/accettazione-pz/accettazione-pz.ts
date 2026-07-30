import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RicercaPz } from './ricerca-pz/ricerca-pz';
import { FormAccettazionePz } from './form-accettazione-pz/form-accettazione-pz';
import { PazienteAnagrafica } from '../../core/Pazienti/Pazienti.model';

/**
 * Pagina di Accettazione Paziente.
 *
 * Orchestrazione del workflow "Ricerca e Accettazione Avanzata" (Task 2):
 * - Il componente di ricerca (RicercaPz) permette di cercare un paziente già
 *   presente in anagrafica per Codice Fiscale, oppure per Nome, Cognome e
 *   Data di Nascita.
 * - Se un paziente viene selezionato dai risultati, i suoi dati anagrafici
 *   storici vengono passati (tramite signal + input) al componente form
 *   (FormAccettazionePz), che li precompila con patchValue.
 * - Se il paziente è nuovo (o non viene trovato), l'operatore può scegliere
 *   "Nuovo Paziente" per compilare una scheda anagrafica da zero.
 * - Il form viene mostrato solo dopo che una di queste due scelte è stata
 *   effettuata.
 */
@Component({
  selector: 'his-accettazione-pz',
  imports: [RicercaPz, FormAccettazionePz],
  templateUrl: './accettazione-pz.html',
  styleUrl: './accettazione-pz.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccettazionePz {
  readonly pazienteTrovato = signal<PazienteAnagrafica | null>(null);
  readonly mostraForm = signal(false);

  public onPazienteSelezionato(pz: PazienteAnagrafica) {
    this.pazienteTrovato.set(pz);
    this.mostraForm.set(true);
  }

  public onNuovoPaziente() {
    this.pazienteTrovato.set(null);
    this.mostraForm.set(true);
  }
}
