import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { StaffManager } from '../../core/Staff/staff-manager';
import { NewStaff, ROLE_OPTIONS, Staff, UserRole } from '../../core/Staff/staff.model';
import { usernameDisponibileValidator } from '../../core/Staff/username-disponibile.validator';

@Component({
  selector: 'his-gestione-personale',
  imports: [
    ReactiveFormsModule,
    TableModule,
    Button,
    Dialog,
    InputText,
    Password,
    Select,
    Message,
    Tag,
  ],
  templateUrl: './gestione-personale.html',
  styleUrl: './gestione-personale.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionePersonale {
  readonly staffManager = inject(StaffManager);
  readonly roleOptions = ROLE_OPTIONS;
  readonly #fb = inject(FormBuilder);

  showCreateDialog = signal(false);
  showEditDialog = signal(false);
  operatoreInModifica = signal<Staff | null>(null);
  erroreServer = signal<string | null>(null);
  salvataggioInCorso = signal(false);

  nuovoOperatoreForm = this.#fb.group({
    username: [
      '',
      [Validators.required, Validators.minLength(4)],
      [usernameDisponibileValidator(this.staffManager)],
    ],
    password: ['', [Validators.required, Validators.minLength(4)]],
    role: ['', [Validators.required]],
  });

  modificaRuoloForm = this.#fb.group({
    role: ['', [Validators.required]],
  });

  constructor() {
    this.staffManager.fetchStaff();
  }

  public roleLabel(role: UserRole): string {
    return this.roleOptions.find((r) => r.code === role)?.label ?? role;
  }

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

  public apriCreazione() {
    this.erroreServer.set(null);
    this.nuovoOperatoreForm.reset({ username: '', password: '', role: '' });
    this.showCreateDialog.set(true);
  }

  public chiudiCreazione() {
    this.showCreateDialog.set(false);
  }

  public onSubmitCreazione() {
    if (this.nuovoOperatoreForm.invalid || this.nuovoOperatoreForm.pending) {
      this.nuovoOperatoreForm.markAllAsTouched();
      return;
    }

    this.erroreServer.set(null);
    this.salvataggioInCorso.set(true);
    const nuovoOperatore = this.nuovoOperatoreForm.value as NewStaff;

    this.staffManager.createStaff(nuovoOperatore).subscribe({
      next: () => {
        this.salvataggioInCorso.set(false);
        this.showCreateDialog.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.salvataggioInCorso.set(false);
        this.erroreServer.set(err.error?.message ?? "Errore durante la creazione dell'operatore.");
      },
    });
  }

  public apriModifica(staff: Staff) {
    this.erroreServer.set(null);
    this.operatoreInModifica.set(staff);
    this.modificaRuoloForm.reset({ role: staff.role });
    this.showEditDialog.set(true);
  }

  public chiudiModifica() {
    this.showEditDialog.set(false);
  }

  public onSubmitModifica() {
    const staff = this.operatoreInModifica();
    if (!staff || this.modificaRuoloForm.invalid) {
      this.modificaRuoloForm.markAllAsTouched();
      return;
    }

    this.erroreServer.set(null);
    this.salvataggioInCorso.set(true);
    const role = this.modificaRuoloForm.value.role as UserRole;

    this.staffManager.editUserRole(staff.id, role).subscribe({
      next: () => {
        this.salvataggioInCorso.set(false);
        this.showEditDialog.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.salvataggioInCorso.set(false);
        this.erroreServer.set(err.error?.message ?? "Errore durante la modifica dell'operatore.");
      },
    });
  }

  public toggleAttivazione(staff: Staff) {
    this.staffManager.setActivation(staff.id, !staff.isActive).subscribe({
      error: (err) => {
        console.error("Errore durante l'attivazione/disattivazione dell'operatore:", err);
      },
    });
  }
}
