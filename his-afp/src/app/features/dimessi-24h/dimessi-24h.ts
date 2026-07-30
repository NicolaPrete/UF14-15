import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { PatientManager } from '../../core/Pazienti/patient-manager';

/**
 * Dashboard di sola consultazione (Report) che mostra esclusivamente i
 * pazienti dimessi (stato DIM) nelle ultime 24 ore, per permettere al
 * coordinatore di reparto di monitorare il turnover dei posti letto.
 *
 * Il filtro sullo stato DIM e sulla finestra temporale delle 24 ore è
 * applicato lato backend (GET /admissions/reports/discharged); qui ci
 * limitiamo a mostrare i dati e a rendere la tabella ordinabile per
 * orario di dimissione.
 */
@Component({
  selector: 'his-dimessi-24h',
  imports: [TableModule, Button, Message, DatePipe],
  templateUrl: './dimessi-24h.html',
  styleUrl: './dimessi-24h.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dimessi24h implements OnInit {
  readonly patientManager = inject(PatientManager);

  ngOnInit() {
    this.aggiorna();
  }

  public aggiorna() {
    this.patientManager.fetchDimessiUltime24h();
  }
}
