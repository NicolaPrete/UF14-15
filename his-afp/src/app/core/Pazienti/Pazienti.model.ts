export interface Paziente {
  id: string; // id
  nome: string; // nome
  cognome: string; // cognome
  braccialetto: string; // braccialetto
  eta: number; // da calcolare con dataNascita
  codiceColore: string; // coloreCode
  note: string; // noteTriage
  patologia: string; // patologiaCode
}

export interface PazienteDTO {
  id: number;
  braccialetto: string;
  dataOraIngresso: string;
  stato: string;
  noteTriage: string;
  patologiaCode: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  sex: string;
  codiceFiscale: string;
  patologiaDescrizione: string;
  coloreCode: string;
  coloreHex: string;
  coloreNome: string;
  modalitaArrivoCode: string;
  modalitaArrivoDescrizione: string;

  indirizzoVia: string;
  indirizzoCivico: string;
  comune: string;
  provincia: string;
}

export interface PatientAdmission {
  anagrafica: {
    nome: string;
    cognome: string;
    dataNascita: string;
    codiceFiscale: string;
    sesso: string;
  };
  sanitaria: {
    patologia: string;
    codiceColore: string;
    modArrivo: string;
    noteTriage: string;
  };
  residenza: {
    via: string;
    civico: string;
    comune: string;
    provincia: string;
  };
}

export interface PatientAdmissionRes {
  id: number;
  braccialetto: string;
}

/**
 * Riga raw restituita da GET /patients/search (colonne snake_case della tabella `patients`).
 */
export interface PazienteAnagraficaDTO {
  id: number;
  codice_fiscale: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  sex: string;
  indirizzo_via: string | null;
  indirizzo_civico: string | null;
  comune: string | null;
  provincia: string | null;
  created_at: string;
}

/**
 * Anagrafica storica di un paziente, così come utilizzata nel frontend (camelCase).
 */
export interface PazienteAnagrafica {
  id: number;
  codiceFiscale: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  sesso: string;
  indirizzoVia: string | null;
  indirizzoCivico: string | null;
  comune: string | null;
  provincia: string | null;
}

export type ModalitaRicercaPz = 'cf' | 'anagrafica';

export interface CriteriRicercaCF {
  cf: string;
}

export interface CriteriRicercaAnagrafica {
  nome: string;
  cognome: string;
  data_nascita: string;
}

/**
 * Riga restituita da GET /admissions/reports/discharged.
 * Le chiavi sono già in camelCase perché la query SQL le alias esplicitamente.
 */
export interface PazienteDimesso {
  braccialetto: string;
  nome: string;
  cognome: string;
  dataOraIngresso: string;
  dataOraDimissione: string;
}

