// ============================================================
//  WEBAUTHN — Registro y autenticación con huella dactilar
// ============================================================

const RP_ID   = location.hostname === 'localhost' ? 'localhost' : location.hostname;
const RP_NAME = 'Asistencia Docente CENS';

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function base64ToBuffer(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}

/**
 * Registra la huella del docente en este dispositivo.
 * Guarda la credencial en localStorage.
 * @param {string} nombre
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function registrarHuella(nombre) {
  try {
    if (!window.PublicKeyCredential) {
      return { ok: false, error: 'Tu navegador no soporta autenticación biométrica.' };
    }

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return { ok: false, error: 'Este dispositivo no tiene autenticador biométrico disponible.' };
    }

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge:        crypto.getRandomValues(new Uint8Array(32)),
        rp:               { id: RP_ID, name: RP_NAME },
        user: {
          id:             userId,
          name:           nombre.toLowerCase().replace(/\s+/g, '.'),
          displayName:    nombre
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification:        'required',
          residentKey:             'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });

    // Guardar credencial en localStorage
    const credData = {
      id:        credential.id,
      rawId:     bufferToBase64(credential.rawId),
      nombre:    nombre,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('asistencia_cred', JSON.stringify(credData));
    return { ok: true };

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      return { ok: false, error: 'Permiso denegado o tiempo agotado. Intentá de nuevo.' };
    }
    if (err.name === 'InvalidStateError') {
      return { ok: false, error: 'Ya existe una credencial en este dispositivo. Usá "Fichar".' };
    }
    console.error('WebAuthn register error:', err);
    return { ok: false, error: `Error: ${err.message}` };
  }
}

/**
 * Autentica con huella (sin credentialId — deja que el dispositivo elija).
 * @returns {Promise<{ok:boolean, nombre?:string, error?:string}>}
 */
export async function autenticarHuella() {
  try {
    const stored = localStorage.getItem('asistencia_cred');
    if (!stored) {
      return { ok: false, error: 'No hay huella registrada en este dispositivo. Primero registrate.' };
    }
    const credData = JSON.parse(stored);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge:         crypto.getRandomValues(new Uint8Array(32)),
        rpId:              RP_ID,
        allowCredentials:  [{
          type:            'public-key',
          id:              base64ToBuffer(credData.rawId),
          transports:      ['internal']
        }],
        userVerification:  'required',
        timeout:           60000
      }
    });

    if (assertion) {
      return { ok: true, nombre: credData.nombre };
    }
    return { ok: false, error: 'Autenticación fallida.' };

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      return { ok: false, error: 'Autenticación cancelada o tiempo agotado.' };
    }
    console.error('WebAuthn auth error:', err);
    return { ok: false, error: `Error: ${err.message}` };
  }
}

/**
 * Devuelve el nombre guardado si ya está registrado, null si no.
 */
export function getDocenteRegistrado() {
  const stored = localStorage.getItem('asistencia_cred');
  if (!stored) return null;
  try {
    return JSON.parse(stored).nombre;
  } catch { return null; }
}

/**
 * Borra la credencial local (para volver a registrar).
 */
export function borrarCredencial() {
  localStorage.removeItem('asistencia_cred');
}
