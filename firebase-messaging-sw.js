// firebase-messaging-sw.js
// Service worker de Buscatools para Web Push (Firebase Cloud Messaging).
//
// DEBE vivir en la RAÍZ del sitio (mismo nivel que index.html), con ESE
// nombre exacto: es el que Firebase Messaging busca registrar por default
// (getToken()/onMessage() del SDK compat asumen '/firebase-messaging-sw.js').
//
// Qué hace:
//  - Deja que el SDK de Firebase Messaging muestre la notificación del
//    sistema cuando llega un push y la web está en segundo plano/cerrada
//    (usa el bloque "notification" que ya manda la Edge Function
//    send-employee-message — no hace falta godoing manual acá, así se
//    evita el bug típico de notificación duplicada).
//  - Maneja notificationclick: si Buscatools ya está abierta en alguna
//    pestaña, la enfoca y navega a la conversación; si no, abre una
//    pestaña nueva directo en esa conversación.
//
// La apiKey de Firebase Web NO es secreta (está pensada para ir en el
// cliente — la seguridad real la da FCM/Google, no el ocultamiento de
// esta key). Las credenciales que SÍ son secretas (Service Account,
// Admin SDK) viven únicamente en la Edge Function de Supabase.

importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB_iJCKO0z7aQVqk-pS8IBBZzdUrRAQKak",
  authDomain: "buscatoolserp.firebaseapp.com",
  databaseURL: "https://buscatoolserp-default-rtdb.firebaseio.com",
  projectId: "buscatoolserp",
  storageBucket: "buscatoolserp.firebasestorage.app",
  messagingSenderId: "643649563466",
  appId: "1:643649563466:web:d2a68b98ac191f9bd16fb3"
});

// Con esto alcanza para que Firebase muestre la notificación del sistema
// en segundo plano usando el bloque "notification" del mensaje FCM.
// (No usamos onBackgroundMessage() con showNotification() propio para
// no terminar mostrando la notificación DOS veces.)
const messaging = firebase.messaging();

// ── Click en la notificación: enfocar pestaña existente o abrir una nueva ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  // FCM entrega el payload "data" del mensaje acá (fcmOptions.link también
  // termina reflejado, pero preferimos el data.url explícito que arma
  // la Edge Function: /?chat=<user>&msg=<id>)
  const targetPath = data.url || './index.html';
  const targetUrl = new URL(targetPath, self.registration.scope).href;

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // ¿Ya hay una pestaña de Buscatools abierta? Enfocarla y navegarla.
    for (const client of allClients) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(targetUrl); } catch (e) { /* algunos navegadores no lo permiten, no pasa nada */ }
        }
        client.postMessage({ type: 'buscatools-notification-click', data });
        return;
      }
    }
    // No había ninguna pestaña abierta: abrir una nueva directo en la conversación.
    await clients.openWindow(targetUrl);
  })());
});

// Evita notificaciones "fantasma" cuando el usuario las cierra sin tocarlas
// (no hace falta lógica especial acá; se deja explícito por claridad).
self.addEventListener('notificationclose', () => {});
