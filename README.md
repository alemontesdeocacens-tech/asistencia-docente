# 📋 Asistencia Docente CENS — Guía de instalación

Sistema de fichaje con huella dactilar para docentes. PWA deployable en GitHub Pages.

---

## Arquitectura

```
Celular del docente (PWA)
    → WebAuthn (huella dactilar, local en el dispositivo)
    → Geolocalización GPS
    → Firestore (guarda el fichaje)

Google Sheets (Drive)
    ← Apps Script (sincroniza desde Firestore cada 1 hora)
    ← Panel de consulta (panel.html, acceso directo para directora/secretario)
```

---

## Paso 1 — Configurar Firebase

1. Entrá a [Firebase Console](https://console.firebase.google.com/)
2. Usá tu proyecto existente (`gestion-docente-3545d`) o creá uno nuevo
3. Habilitá **Firestore Database** en modo producción
4. Agregá una **Web App** y copiá la configuración
5. Editá `js/firebase-config.js` y completá todos los campos `TU_*`

### Reglas de Firestore sugeridas

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cualquiera puede escribir fichajes (los docentes no están autenticados)
    match /fichajes/{doc} {
      allow write: if true;
      allow read: if request.auth != null; // solo lectura autenticada
    }
  }
}
```

> **Nota:** Para simplificar, los docentes no hacen login con Firebase Auth.
> La seguridad está dada por WebAuthn (huella) + que solo se puede escribir, no leer.
> El panel de consulta requiere autenticación para leer (o podés usar reglas abiertas
> si preferís no tener login en el panel).

---

## Paso 2 — Configurar la ubicación del CENS

En `js/geo.js`, reemplazá las coordenadas:

```js
export const CENS_LAT = -34.XXXXX; // latitud real del CENS
export const CENS_LNG = -58.XXXXX; // longitud real del CENS
export const RADIO_METROS = 200;   // radio aceptable (ajustá según el edificio)
```

Para obtener las coordenadas: abrí Google Maps, hacé clic derecho sobre el edificio → "¿Qué hay aquí?".

---

## Paso 3 — Generar íconos PWA

La app necesita iconos en `icons/icon-192.png` e `icons/icon-512.png`.
Podés generarlos desde cualquier imagen en [https://realfavicongenerator.net](https://realfavicongenerator.net)
o con la herramienta que prefieras.

---

## Paso 4 — Subir a GitHub Pages

```bash
# Desde la carpeta del proyecto
git init
git add .
git commit -m "Initial commit - Asistencia Docente CENS"
git remote add origin https://github.com/TU_USUARIO/asistencia-docente.git
git push -u origin main
```

Luego en GitHub: Settings → Pages → Branch: main → /root → Save.

La app quedará en: `https://TU_USUARIO.github.io/asistencia-docente/`

---

## Paso 5 — Configurar Apps Script (sincronización a Google Sheets)

1. Creá un Google Sheet nuevo en tu Drive
2. Extensiones → Apps Script
3. Pegá el contenido de `apps-script/sincronizar-sheets.gs`
4. Completá `FIREBASE_PROJECT_ID` y `FIREBASE_API_KEY`
5. Ejecutá `setupTrigger()` UNA vez
6. Autorizá los permisos

El Sheet se actualizará automáticamente cada 1 hora.
También podés ejecutar `sincronizarAhora()` para forzar una actualización.

---

## Uso por los docentes

### Primera vez (registro de huella)
1. Entrar a la URL de GitHub Pages desde el celular
2. Si están en Android Chrome: menú → "Agregar a pantalla de inicio"
3. Ingresar nombre completo
4. Tocar "Registrar con huella" y verificar con el sensor biométrico
5. Listo — el dispositivo recuerda la huella

### Fichajes siguientes
1. Abrir la app
2. Tocar el botón circular
3. Verificar con huella
4. El sistema registra timestamp + GPS automáticamente

---

## Panel de consulta (directora / secretario)

Acceder a: `https://TU_USUARIO.github.io/asistencia-docente/panel.html`

- Filtrar por rango de fechas y/o nombre de docente
- Ver estadísticas del período
- Exportar a CSV

---

## Limitaciones conocidas

- **Cambio de dispositivo:** si un docente cambia de celular, debe registrar la huella de nuevo (by design de WebAuthn)
- **Sin internet:** el fichaje requiere conexión para guardar en Firestore; sin internet falla
- **Safari iOS:** WebAuthn con huella funciona desde iOS 16+
- **Android:** requiere Chrome o cualquier navegador basado en Chromium

---

## Estructura del proyecto

```
asistencia-docente/
├── index.html              ← App para docentes
├── panel.html              ← Panel directora/secretario
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js  ← ⚠ Completar con tus credenciales
│   ├── webauthn.js         ← Lógica de huella dactilar
│   ├── geo.js              ← ⚠ Completar con coordenadas del CENS
│   └── app.js              ← Lógica principal
├── icons/
│   ├── icon-192.png        ← ⚠ Generar (ver Paso 3)
│   └── icon-512.png        ← ⚠ Generar (ver Paso 3)
└── apps-script/
    └── sincronizar-sheets.gs  ← ⚠ Pegar en Apps Script (ver Paso 5)
```
