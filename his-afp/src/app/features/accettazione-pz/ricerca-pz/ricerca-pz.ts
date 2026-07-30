import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { Message } from 'primeng/message';
import { Fieldset } from 'primeng/fieldset';
import { TableModule } from 'primeng/table';
import { DatePipe } from '@angular/common';
import { PatientManager } from '../../../core/Pazienti/patient-manager';
import { ModalitaRicercaPz, PazienteAnagrafica } from '../../../core/Pazienti/Pazienti.model';

interface ModalitaOption {
  label: string;
  value: ModalitaRicercaPz;
}

/**
 * Componente di ricerca dell'anagrafica pazienti.
 * Supporta due modalità: ricerca esatta per Codice Fiscale, oppure ricerca
 * per Nome, Cognome e Data di Nascita. Notifica il componente contenitore
 * quando un paziente viene selezionato dai risultati, oppure quando
 * l'operatore sceglie di procedere con un "Nuovo Paziente".
 */
@Component({
  selector: 'his-ricerca-pz',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    Button,
    InputText,
    DatePicker,
    SelectButton,
    Message,
    Fieldset,
    TableModule,
    DatePipe,
  ],
  templateUrl: './ricerca-pz.html',
  styleUrl: './ricerca-pz.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RicercaPz {
  readonly patientManager = inject(PatientManager);
  readonly #fb = inject(FormBuilder);

  readonly maxDate = new Date();
  readonly modalitaOptions: ModalitaOption[] = [
    { label: 'Codice Fiscale', value: 'cf' },
    { label: 'Nome, Cognome e Data di nascita', value: 'anagrafica' },
  ];

  readonly modalita = signal<ModalitaRicercaPz>('cf');

  readonly pazienteSelezionato = output<PazienteAnagrafica>();
  readonly nuovoPaziente = output<void>();

  ricercaCfForm = this.#fb.group({
    codiceFiscale: [
      '',
      [Validators.required, Validators.pattern('[A-Za-z]{6}\\d{2}[A-Za-z]\\d{2}[A-Za-z]\\d{3}[A-Za-z]')],
    ],
  });

  ricercaAnagraficaForm = this.#fb.group({
    nome: ['', [Validators.required]],
    cognome: ['', [Validators.required]],
    dataNascita: this.#fb.control<Date | null>(null, [Validators.required]),
  });

  public checkFormControl(form: FormGroup, control: string) {
    const fc = form.get(control);
    return fc?.invalid && (fc.touched || fc.dirty);
  }

  public checkFormControlError(form: FormGroup, control: string, err: string) {
    const fc = form.get(control);
    if (fc && fc.hasError(err)) {
      return fc.getError(err);
    }
    return null;
  }

  public cambiaModalita(nuovaModalita: ModalitaRicercaPz) {
    this.modalita.set(nuovaModalita);
    this.patientManager.resetRicerca();
  }

  public cercaPerCodiceFiscale() {
    if (this.ricercaCfForm.invalid) {
      this.ricercaCfForm.markAllAsTouched();
      return;
    }
    const codiceFiscale = (this.ricercaCfForm.value.codiceFiscale ?? '').toUpperCase();
    this.patientManager.cercaPerCodiceFiscale(codiceFiscale);
  }

  public cercaPerAnagrafica() {
    if (this.ricercaAnagraficaForm.invalid) {
      this.ricercaAnagraficaForm.markAllAsTouched();
      return;
    }
    const { nome, cognome, dataNascita } = this.ricercaAnagraficaForm.getRawValue();
    if (!dataNascita) {
      return;
    }
    this.patientManager.cercaPerAnagrafica(nome ?? '', cognome ?? '', this.toISODateString(dataNascita));
  }

  public selezionaPaziente(pz: PazienteAnagrafica) {
    this.pazienteSelezionato.emit(pz);
  }

  public segnalaNuovoPaziente() {
    this.patientManager.resetRicerca();
    this.nuovoPaziente.emit();
  }

  private toISODateString(d: Date): string {
    const anno = d.getFullYear();
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const giorno = String(d.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }
}
