// ============================================================
//  APP.JS — Lógica principal v2
// ============================================================

import { db } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { registrarHuella, autenticarHuella, getDocenteRegistrado } from './webauthn.js';
import { obtenerUbicacion, detectarSede, sedeMasCercana, formatGeo, SEDES } from './geo.js';

// ── Helpers de UI ─────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function showFeedback(elId, msg, type = 'info') {
  const el = $(elId);
  el.textContent = msg;
  el.className = `feedback ${type}`;
}

function hideFeedback(elId) {
  $(elId).className = 'feedback hidden';
}

// ── Reloj ─────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now   = new Date();
    const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    $('display-fecha').textContent =
      `${dias[now.getDay()]} ${now.getDate()} ${meses[now.getMonth()]} ${now.getFullYear()}`;
    $('display-hora').textContent =
      `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ── Inicialización ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {

  // Geolocalización en paralelo — muestra sede detectada
  obtenerUbicacion().then(pos => {
    const geoChip = $('geo-chip');
    const geoText = $('geo-text');
    if (pos.ok) {
      const det = detectarSede(pos.lat, pos.lng);
      if (det) {
        geoText.textContent = `📍 ${det.sede.nombre} (${det.distancia}m)`;
        geoChip.classList.add('ready');
      } else {
        const cercana = sedeMasCercana(pos.lat, pos.lng);
        geoText.textContent = `⚠ Fuera de sede · ${cercana.sede.nombre} a ${cercana.distancia}m`;
        geoChip.classList.add('warn');
      }
    } else {
      geoText.textContent = pos.error || 'Sin ubicación';
    }
  });

  const nombre = getDocenteRegistrado();

  setTimeout(() => {
    if (nombre) {
      $('docente-nombre-header').textContent = nombre;
      startClock();
      cargarUltimoFichaje(nombre);
      showScreen('screen-fichar');
    } else {
      showScreen('screen-register');
    }
  }, 1200);

  // ── Registro ──────────────────────────────────────────
  const inputNombre = $('input-nombre');
  const btnRegister = $('btn-register');

  inputNombre.addEventListener('input', () => {
    btnRegister.disabled = inputNombre.value.trim().length < 3;
  });

  btnRegister.addEventListener('click', async () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) return;

    btnRegister.disabled = true;
    showFeedback('register-feedback', 'Colocá tu dedo en el sensor…', 'info');

    const result = await registrarHuella(nombre);
    if (result.ok) {
      showFeedback('register-feedback', '¡Huella registrada! Podés fichar cuando llegues.', 'success');
      $('docente-nombre-header').textContent = nombre;
      startClock();
      cargarUltimoFichaje(nombre);
      setTimeout(() => showScreen('screen-fichar'), 1500);
    } else {
      showFeedback('register-feedback', result.error, 'error');
      btnRegister.disabled = false;
    }
  });

  $('link-to-fichar').addEventListener('click', e => {
    e.preventDefault();
    hideFeedback('register-feedback');
    $('docente-nombre-header').textContent = 'Verificando…';
    startClock();
    showScreen('screen-fichar');
  });

  // ── Fichaje ──────────────────────────────────────────
  $('btn-fichar').addEventListener('click', async () => {
    $('btn-fichar').disabled = true;
    hideFeedback('fichar-feedback');
    showFeedback('fichar-feedback', 'Verificando huella…', 'info');

    const auth = await autenticarHuella();
    if (!auth.ok) {
      showFeedback('fichar-feedback', auth.error, 'error');
      $('btn-fichar').disabled = false;
      return;
    }

    showFeedback('fichar-feedback', 'Obteniendo ubicación…', 'info');
    const pos = await obtenerUbicacion();

    // Determinar presencia y sede
    let presente   = false;
    let sedeId     = null;
    let sedeNombre = null;
    let distancia  = null;

    if (pos.ok) {
      const det = detectarSede(pos.lat, pos.lng);
      if (det) {
        presente   = true;
        sedeId     = det.sede.id;
        sedeNombre = det.sede.nombre;
        distancia  = det.distancia;
      } else {
        const cercana = sedeMasCercana(pos.lat, pos.lng);
        sedeNombre = cercana.sede.nombre; // sede más cercana aunque esté lejos
        distancia  = cercana.distancia;
      }
    }

    const fichaje = {
      nombre:     auth.nombre,
      timestamp:  serverTimestamp(),
      fecha:      new Date().toLocaleDateString('es-AR'),
      hora:       new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      lat:        pos.ok ? pos.lat      : null,
      lng:        pos.ok ? pos.lng      : null,
      accuracy:   pos.ok ? pos.accuracy : null,
      geoOk:      pos.ok,
      presente:   presente,           // ← PRESENTE / AUSENTE
      sedeId:     sedeId,             // id de sede si PRESENTE
      sedeNombre: sedeNombre,         // nombre de sede (la más cercana si AUSENTE)
      distancia:  distancia           // metros a la sede
    };

    try {
      await addDoc(collection(db, 'fichajes'), fichaje);

      // Pantalla de éxito
      $('success-detail').textContent = `${auth.nombre} · ${fichaje.fecha} ${fichaje.hora}`;

      if (presente) {
        $('success-geo').textContent  = `✅ PRESENTE en ${sedeNombre} (${distancia}m)`;
        $('success-geo').style.color  = '#2d7a4f';
      } else if (pos.ok) {
        $('success-geo').textContent  = `⚠ AUSENTE · Fuera de sede · ${sedeNombre} a ${distancia}m`;
        $('success-geo').style.color  = '#b83232';
      } else {
        $('success-geo').textContent  = `⚠ AUSENTE · No se pudo verificar ubicación`;
        $('success-geo').style.color  = '#b83232';
      }

      showScreen('screen-success');
      cargarUltimoFichaje(auth.nombre);

    } catch (err) {
      console.error(err);
      showFeedback('fichar-feedback', 'Error al guardar. Verificá la conexión.', 'error');
      $('btn-fichar').disabled = false;
    }
  });

  $('btn-back').addEventListener('click', () => {
    hideFeedback('fichar-feedback');
    $('btn-fichar').disabled = false;
    showScreen('screen-fichar');
  });

  $('link-to-register').addEventListener('click', e => {
    e.preventDefault();
    hideFeedback('fichar-feedback');
    showScreen('screen-register');
  });

});

// ── Último fichaje del docente ────────────────────────────
async function cargarUltimoFichaje(nombre) {
  try {
    const q = query(
      collection(db, 'fichajes'),
      where('nombre', '==', nombre),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0].data();
      $('ultimo-fichaje-data').textContent =
        `${d.fecha} a las ${d.hora} · ${d.presente ? '✅ PRESENTE' : '⚠ AUSENTE'}`;
      $('ultimo-fichaje-wrap').classList.remove('hidden');
    }
  } catch (e) { /* silencioso */ }
}
