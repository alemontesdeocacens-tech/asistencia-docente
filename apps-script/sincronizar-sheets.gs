// ============================================================
//  APPS SCRIPT — Sincronización Firestore → Google Sheets v2
//  Incluye columnas: PRESENTE/AUSENTE, Sede, Distancia
//
//  CÓMO USAR:
//  1. Google Sheets → Extensiones → Apps Script
//  2. Pegá este código completo
//  3. Completá FIREBASE_PROJECT_ID y FIREBASE_API_KEY abajo
//  4. Ejecutá setupTrigger() UNA sola vez
//  5. Autorizá los permisos
// ============================================================

const FIREBASE_PROJECT_ID = 'TU_PROYECTO_ID';  // ← igual que en firebase-config.js
const FIREBASE_API_KEY    = 'TU_API_KEY';       // ← igual que en firebase-config.js
const SHEET_FICHAJES      = 'Fichajes';
const SHEET_RESUMEN       = 'Resumen por Docente';
const SHEET_SEDES         = 'Resumen por Sede';
const SYNC_INTERVAL_HOURS = 1;

// ── FUNCIÓN PRINCIPAL ──────────────────────────────────────
function sincronizarFichajes() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/fichajes?key=${FIREBASE_API_KEY}&pageSize=500`;

  try {
    const response = UrlFetchApp.fetch(url);
    const data     = JSON.parse(response.getContentText());

    if (!data.documents || data.documents.length === 0) {
      Logger.log('Sin documentos en Firestore.');
      return;
    }

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName(SHEET_FICHAJES) || ss.insertSheet(SHEET_FICHAJES);

    // Encabezados
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Nombre', 'Fecha', 'Hora',
        'Estado',          // ← PRESENTE / AUSENTE
        'Sede',            // ← nombre de la sede
        'Latitud', 'Longitud', 'Precisión GPS (m)', 'Distancia a sede (m)',
        'GPS OK', 'Timestamp ISO', 'ID Documento'
      ];
      const rH = sheet.getRange(1, 1, 1, headers.length);
      rH.setValues([headers]);
      rH.setFontWeight('bold').setBackground('#1a2744').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // IDs ya existentes para no duplicar
    const lastRow       = sheet.getLastRow();
    const idsExistentes = new Set();
    if (lastRow > 1) {
      sheet.getRange(2, 12, lastRow - 1, 1).getValues().forEach(r => idsExistentes.add(r[0]));
    }

    // Procesar documentos nuevos
    const nuevasFilas = [];
    data.documents.forEach(doc => {
      const id = doc.name.split('/').pop();
      if (idsExistentes.has(id)) return;

      const f       = doc.fields || {};
      const nombre  = f.nombre?.stringValue     || '';
      const fecha   = f.fecha?.stringValue       || '';
      const hora    = f.hora?.stringValue        || '';
      const presente= f.presente?.booleanValue   === true ? 'PRESENTE' : 'AUSENTE';
      const sede    = f.sedeNombre?.stringValue  || (f.presente?.booleanValue ? '' : 'Fuera de sede');
      const lat     = f.lat?.doubleValue         ?? f.lat?.integerValue    ?? '';
      const lng     = f.lng?.doubleValue         ?? f.lng?.integerValue    ?? '';
      const acc     = f.accuracy?.integerValue   ?? f.accuracy?.doubleValue ?? '';
      const dist    = f.distancia?.integerValue  ?? '';
      const geoOk   = f.geoOk?.booleanValue      ? 'Sí' : 'No';
      const ts      = doc.createTime             || '';

      nuevasFilas.push([nombre, fecha, hora, presente, sede, lat, lng, acc, dist, geoOk, ts, id]);
    });

    if (nuevasFilas.length > 0) {
      const startRow = Math.max(sheet.getLastRow() + 1, 2);
      sheet.getRange(startRow, 1, nuevasFilas.length, 12).setValues(nuevasFilas);

      // Colorear columna Estado (col 4)
      for (let i = 0; i < nuevasFilas.length; i++) {
        const row     = startRow + i;
        const estado  = nuevasFilas[i][3];
        const cellEst = sheet.getRange(row, 4);
        if (estado === 'PRESENTE') {
          cellEst.setBackground('#e6f4ed').setFontColor('#2d7a4f').setFontWeight('bold');
        } else {
          cellEst.setBackground('#fde8e8').setFontColor('#b83232').setFontWeight('bold');
        }
        // Zebra en el resto
        if (row % 2 === 0) {
          sheet.getRange(row, 1, 1, 3).setBackground('#f5f0e8');
          sheet.getRange(row, 5, 1, 8).setBackground('#f5f0e8');
        }
      }

      Logger.log(`✓ ${nuevasFilas.length} fichaje(s) importados.`);
      actualizarResumenDocentes(ss);
      actualizarResumenSedes(ss);
    } else {
      Logger.log('No hay fichajes nuevos.');
    }

  } catch (err) {
    Logger.log('Error: ' + err.toString());
  }
}

// ── RESUMEN POR DOCENTE ────────────────────────────────────
function actualizarResumenDocentes(ss) {
  let sheet = ss.getSheetByName(SHEET_RESUMEN) || ss.insertSheet(SHEET_RESUMEN);
  sheet.clearContents();
  sheet.clearFormats();

  sheet.getRange('A1').setValue('📊 Resumen de Asistencia por Docente')
    .setFontWeight('bold').setFontSize(13);
  sheet.getRange('A2').setValue('Última actualización: ' + new Date().toLocaleString('es-AR'));

  const headers = ['Docente', 'Total fichajes', 'Presentes', 'Ausentes', '% Asistencia', 'Último fichaje'];
  const rH = sheet.getRange(4, 1, 1, headers.length);
  rH.setValues([headers]).setFontWeight('bold').setBackground('#1a2744').setFontColor('#ffffff');
  sheet.setFrozenRows(4);

  // Tabla dinámica con QUERY
  sheet.getRange('A5').setFormula(
    `=IFERROR(QUERY('${SHEET_FICHAJES}'!A:L,` +
    `"SELECT A, COUNT(A), COUNTIF(D,'PRESENTE'), COUNTIF(D,'AUSENTE'), ` +
    `COUNTIF(D,'PRESENTE')/COUNT(A)*100, MAX(B) ` +
    `WHERE A <> 'Nombre' AND A <> '' GROUP BY A ORDER BY COUNT(A) DESC ` +
    `LABEL A 'Docente', COUNT(A) 'Total', COUNTIF(D,'PRESENTE') 'Presentes', ` +
    `COUNTIF(D,'AUSENTE') 'Ausentes', COUNTIF(D,'PRESENTE')/COUNT(A)*100 '% Asistencia', MAX(B) 'Último'"),` +
    `"Sin datos")`
  );

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidths(2, 5, 120);
}

// ── RESUMEN POR SEDE ───────────────────────────────────────
function actualizarResumenSedes(ss) {
  let sheet = ss.getSheetByName(SHEET_SEDES) || ss.insertSheet(SHEET_SEDES);
  sheet.clearContents();
  sheet.clearFormats();

  sheet.getRange('A1').setValue('🏫 Resumen por Sede')
    .setFontWeight('bold').setFontSize(13);
  sheet.getRange('A2').setValue('Última actualización: ' + new Date().toLocaleString('es-AR'));

  const headers = ['Sede', 'Total fichajes presentes'];
  const rH = sheet.getRange(4, 1, 1, headers.length);
  rH.setValues([headers]).setFontWeight('bold').setBackground('#1a2744').setFontColor('#ffffff');

  sheet.getRange('A5').setFormula(
    `=IFERROR(QUERY('${SHEET_FICHAJES}'!E:E,` +
    `"SELECT E, COUNT(E) WHERE E <> 'Sede' AND E <> '' AND E <> 'Fuera de sede' ` +
    `GROUP BY E ORDER BY COUNT(E) DESC LABEL E 'Sede', COUNT(E) 'Total presentes'"),` +
    `"Sin datos")`
  );

  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 160);
}

// ── TRIGGER ────────────────────────────────────────────────
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sincronizarFichajes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarFichajes')
    .timeBased().everyHours(SYNC_INTERVAL_HOURS).create();
  Logger.log(`✓ Trigger: cada ${SYNC_INTERVAL_HOURS} hora(s).`);
}

function sincronizarAhora() { sincronizarFichajes(); }
