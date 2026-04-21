// ============================================================
//  GEO — Sedes del CENS y validación de ubicación
//  Partido de La Matanza, Provincia de Buenos Aires
//  Coordenadas verificadas en Google Maps — abril 2026
// ============================================================

export const SEDES = [
  {
    id:        'sede_principal',
    nombre:    'Sede Principal – Villa Luzuriaga',
    direccion: 'Camacuá 3407, Villa Luzuriaga',
    lat:       -34.66739891289625,
    lng:       -58.591203086508806,
    radio:     200
  },
  {
    id:        'anexo_ramos_mejia',
    nombre:    'Anexo Ramos Mejía',
    direccion: 'Bolívar 1682, Ramos Mejía',
    lat:       -34.65488173857338,
    lng:       -58.5542877333928,
    radio:     200
  },
  {
    id:        'anexo_atalaya',
    nombre:    'Anexo Atalaya – Rafael Castillo',
    direccion: 'Del Bañado 10, Rafael Castillo',
    lat:       -34.69172021342673,
    lng:       -58.609198562226716,
    radio:     200
  },
  {
    id:        'anexo_torrero',
    nombre:    'Anexo Torrero – Rafael Castillo',
    direccion: 'Coronel Aguirre 2784, Rafael Castillo',
    lat:       -34.708068577331645,
    lng:       -58.62965984688062,
    radio:     200
  },
  {
    id:        'anexo_canada',
    nombre:    'Anexo Cañada – San Justo',
    direccion: 'Cañada 4664, San Justo',
    lat:       -34.69932955407448,
    lng:       -58.56948884734436,
    radio:     200
  }
];

// Compatibilidad retroactiva — apunta a la sede principal
export const CENS_LAT     = SEDES[0].lat;
export const CENS_LNG     = SEDES[0].lng;
export const RADIO_METROS = SEDES[0].radio;

let cachedPosition = null;

export async function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, error: 'El dispositivo no soporta geolocalización.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPosition = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          ok:       true
        };
        resolve(cachedPosition);
      },
      (err) => {
        let msg = 'No se pudo obtener la ubicación.';
        if (err.code === 1) msg = 'Permiso de ubicación denegado.';
        if (err.code === 2) msg = 'Ubicación no disponible.';
        if (err.code === 3) msg = 'Tiempo agotado al obtener ubicación.';
        resolve({ ok: false, error: msg });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

export function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function detectarSede(lat, lng) {
  let mejorSede      = null;
  let mejorDistancia = Infinity;
  for (const sede of SEDES) {
    const dist = distanciaMetros(lat, lng, sede.lat, sede.lng);
    if (dist <= sede.radio && dist < mejorDistancia) {
      mejorSede      = sede;
      mejorDistancia = dist;
    }
  }
  return mejorSede ? { sede: mejorSede, distancia: Math.round(mejorDistancia) } : null;
}

export function sedeMasCercana(lat, lng) {
  let mejor    = null;
  let mejorDist = Infinity;
  for (const sede of SEDES) {
    const dist = distanciaMetros(lat, lng, sede.lat, sede.lng);
    if (dist < mejorDist) { mejor = sede; mejorDist = dist; }
  }
  return { sede: mejor, distancia: Math.round(mejorDist) };
}

export function formatGeo(lat, lng, accuracy) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy}m)`;
}

export function getCachedPosition() { return cachedPosition; }
