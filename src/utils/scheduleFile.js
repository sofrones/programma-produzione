import * as XLSX from 'xlsx';

// ============================================================
// Helper di formattazione/parsing data e numeri
// ============================================================

function pad2(n) {
  return String(n).padStart(2, '0');
}

// "2026-09-17" -> "17/09/2026"
export function isoToItalianDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// Accetta "17/09/2026", "17-09-2026", "2026-09-17", un numero seriale Excel
// o un oggetto Date -> restituisce sempre "2026-09-17" (o null se non valido).
export function parseFlexibleDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  if (typeof value === 'number') {
    // Numero seriale Excel (giorni trascorsi dal 30/12/1899)
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + value * 86400000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // ISO: AAAA-MM-GG
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // GG/MM/AAAA o GG-MM-AAAA
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  return null;
}

// Accetta "12,5", "12.5" oppure un numero -> 12.5. Restituisce null se non valido.
export function parseFlexibleNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

// ============================================================
// Lettura file caricato (.xlsx / .csv / .txt)
// ============================================================

function splitDelimitedText(text, delimiter) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

function getFileExtension(fileName) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

// Restituisce { rows: [{ productionDate, rawValue }], errors: [stringhe] }
export async function parseScheduleFile(file) {
  const extension = getFileExtension(file.name);
  let rawRows = [];

  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
  } else if (extension === 'csv') {
    const text = await file.text();
    const delimiter = text.includes(';') ? ';' : ',';
    rawRows = splitDelimitedText(text, delimiter);
  } else if (extension === 'txt') {
    const text = await file.text();
    const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
    rawRows = splitDelimitedText(text, delimiter);
  } else {
    throw new Error('Formato file non supportato. Usa .xlsx, .csv o .txt.');
  }

  const rows = [];
  const errors = [];
  let sawFirstDataRow = false;

  rawRows.forEach((row, index) => {
    if (!row || row.length === 0) return;
    const [dateCell, valueCell] = row;
    if ((dateCell === '' || dateCell === undefined) && (valueCell === '' || valueCell === undefined)) {
      return; // riga vuota, ignorata silenziosamente
    }

    const isoDate = parseFlexibleDate(dateCell);
    if (isoDate === null) {
      // Finché non abbiamo ancora trovato una riga dati valida, qualunque riga
      // senza una data riconoscibile è considerata informativa/di intestazione
      // (es. la riga con impianto/unità o quella "Data;Valore") e viene ignorata
      // senza segnalare errore. Da qui in poi, invece, è un vero errore.
      if (!sawFirstDataRow) return;
      errors.push(`Riga ${index + 1}: data non riconosciuta ("${dateCell}")`);
      return;
    }

    // Una data valida con la cella valore vuota significa semplicemente "nessun
    // dato per questo giorno" (es. un giorno non ancora compilato nel modello
    // scaricato): non è un errore, va solo ignorata senza avvisi.
    const isBlankValue =
      valueCell === '' || valueCell === undefined || valueCell === null ||
      (typeof valueCell === 'string' && valueCell.trim() === '');
    if (isBlankValue) {
      sawFirstDataRow = true;
      return;
    }

    const numericValue = parseFlexibleNumber(valueCell);
    if (numericValue === null) {
      errors.push(`Riga ${index + 1}: valore non numerico ("${valueCell}")`);
      return;
    }

    sawFirstDataRow = true;
    rows.push({ productionDate: isoDate, rawValue: numericValue });
  });

  return { rows, errors };
}

// ============================================================
// Generazione file da scaricare (modello precompilato / esportazione)
// ============================================================

// Riga informativa messa in cima al file, per ricordare sempre in quale unità
// di misura vanno inseriti i valori anche quando si lavora offline sul file.
function buildInfoLine(plant) {
  const unit = plant?.default_input_unit || '';
  const factor = plant?.conversion_factor_to_mwh;
  const factorText = factor !== undefined && factor !== null ? String(factor).replace('.', ',') : '';
  return `Impianto: ${plant?.name || ''}  |  Unità di misura: ${unit}  |  Conversione: 1 ${unit} = ${factorText} MWh_pcs`;
}

function buildTemplateRows(daysInMonth, selectedMonth, schedules, plant) {
  const unit = plant?.default_input_unit || '';
  const infoRow = [buildInfoLine(plant)];
  const header = ['Data', `Valore (${unit})`];
  const body = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = `${selectedMonth}-${pad2(day)}`;
    const record = schedules.find((s) => s.production_date === isoDate);
    const value = record?.raw_input_value ?? '';
    body.push([isoToItalianDate(isoDate), value]);
  }
  return [infoRow, header, ...body];
}

// format: 'xlsx' | 'csv' | 'txt'
export function downloadScheduleTemplate(format, { selectedMonth, daysInMonth, schedules, plant }) {
  const rows = buildTemplateRows(daysInMonth, selectedMonth, schedules, plant);
  const safePlantName = plant?.name ? `${plant.name.replace(/\s+/g, '_')}_` : '';
  const filenameBase = `programmazione_${safePlantName}${selectedMonth}`;

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 14 }, { wch: 14 }];
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Programmazione');
    XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
    return;
  }

  const delimiter = format === 'txt' ? '\t' : ';';
  const text = rows
    .map((row) =>
      row
        .map((cell) => (typeof cell === 'number' ? String(cell).replace('.', ',') : cell))
        .join(delimiter)
    )
    .join('\r\n');

  // Aggiungiamo il BOM UTF-8 così Excel apre correttamente accenti e caratteri speciali.
  const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameBase}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
