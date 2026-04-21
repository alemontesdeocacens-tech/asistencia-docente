// ============================================================
//  FIREBASE CONFIG — completá con tus credenciales
//  Firebase Console → tu proyecto → Configuración → Web app
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB1ODiJOp6NW9hUJoFS_mwA6R0zcAZRU_Y",
  authDomain:        "gestion-docente-3545d-5bd71.firebaseapp.com",
  projectId:         "gestion-docente-3545d-5bd71",
  storageBucket:     "gestion-docente-3545d-5bd71.firebasestorage.app",
  messagingSenderId: "1054865991061",
  appId:             "1:1054865991061:web:767f92fe6492fdf758029c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
