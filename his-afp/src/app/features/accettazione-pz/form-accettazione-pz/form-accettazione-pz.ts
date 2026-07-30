import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { GestioneRisorse } from '../../../core/Risorse/gestione-risorse';
import { InputText } from 'primeng/inputtext';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { DatePicker } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Fieldset } from 'primeng/fieldset';
import { PatientManager } from '../../../core/Pazienti/patient-manager';
import { PatientAdmission, PazienteAnagrafica } from '../../../core/Pazienti/Pazienti.model';

@Component({
  selector: 'his-form-accettazione-pz',
  imports: [
    InputText,
    ReactiveFormsModule,
    Button,
    Message,
    DatePicker,
    SelectModule,
    Textarea,
    Fieldset,
  ],
  templateUrl: './form-accettazione-pz.html',
  styleUrl: './form-accettazione-pz.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormAccettazionePz {
  gestioneRisorse = inject(GestioneRisorse);
  patientManager = inject(PatientManager);

  /**
   * Anagrafica storica del paziente trovato tramite il componente di ricerca.
   * Se null, l'operatore sta creando una scheda anagrafica da zero ("Nuovo Paziente").
   */
  readonly pazienteTrovato = input<PazienteAnagrafica | null>(null);

  readonly maxDate = new Date();
  readonly sexOption = [
    {
      code: 'M',
      desc: 'Maschio',
    },
    {
      code: 'F',
      desc: 'Femmina',
    },
  ];

  readonly #fb = inject(FormBuilder);
  paziente = this.#fb.group({
    anagrafica: this.#fb.group({
      nome: ['', [Validators.required]],
      cognome: ['', [Validators.required]],
      dataNascita: this.#fb.control<Date | null>(null, [Validators.required]),
      codiceFiscale: [
        '',
        [Validators.required, Validators.pattern('[A-Z]{6}\\d{2}[A-Z]\\d{2}[A-Z]\\d{3}[A-Z]')],
        // {pattern: {requiredPattern: '^[a-zA-Z ]*$', actualValue: '1'}}
      ],
      sesso: ['', [Validators.required]],
    }),
    sanitaria: this.#fb.group({
      patologia: ['', [Validators.required]],
      codiceColore: ['', [Validators.required]],
      modArrivo: ['', [Validators.required]],
      noteTriage: ['', [Validators.required, Validators.maxLength(500)]],
    }),
  });

  constructor() {
    // Quando viene selezionato un paziente dalla ricerca, precompiliamo (patchValue)
    // i dati anagrafici storici e li blocchiamo, per permettere all'infermiere di
    // concentrarsi solo sui dati sanitari. Se non c'è nessun paziente (nuovo paziente),
    // riabilitiamo e ripuliamo la sezione anagrafica per l'inserimento da zero.
    effect(() => {
      const pz = this.pazienteTrovato();
      const anagraficaGroup = this.paziente.get('anagrafica');

      if (pz) {
        anagraficaGroup?.patchValue({
          nome: pz.nome,
          cognome: pz.cognome,
          dataNascita: new Date(pz.dataNascita),
          codiceFiscale: pz.codiceFiscale,
          sesso: pz.sesso,
        });
        anagraficaGroup?.disable();
      } else {
        anagraficaGroup?.enable();
        anagraficaGroup?.reset();
      }
    });
  }

  checkFormControl(control: string) {
    const fc = this.paziente.get(control);
    // nome.invalid && (nome.touched || nome.dirty)
    return fc?.invalid && (fc.touched || fc.dirty);
  }
  checkFormControlError(control: string, err: string) {
    const fc = this.paziente.get(control);

    if (fc && fc.hasError(err)) {
      return fc.getError(err);
    } else {
      return null;
    }
  }
  onSubmit() {
    if (this.paziente.valid) {
      // getRawValue() perché la sezione anagrafica può essere disabilitata
      // quando i dati arrivano da un paziente già trovato in ricerca.
      // Il cast passa per `unknown` perché dataNascita è tipizzato come Date
      // (valore reale prodotto da p-datePicker), mentre PatientAdmission si
      // aspetta una string: la serializzazione JSON verso il backend converte
      // comunque la Date in stringa ISO, quindi il comportamento è corretto.
      this.patientManager.admitPatient(this.paziente.getRawValue() as unknown as PatientAdmission);
    } else {
      this.paziente.markAllAsTouched();
    }
  }
}
