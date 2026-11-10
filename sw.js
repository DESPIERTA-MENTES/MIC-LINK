/**
 * Mic-Link Pro DSP - Service Worker (sw.js)
 * Versión de Caché: v1.1.0
 * 
 * Funciones clave:
 * - Habilita la instalación como aplicación nativa (PWA) en Android, iOS, Windows y macOS.
 * - Soporte offline completo: guarda en caché la app, tus imágenes (icono y firma) y librerías.
 * - Limpieza automática de versiones anteriores de caché.
 */

const CACHE_NAME = 'miclink-dsp-v1.1';

// Lista de recursos esenciales que se guardan en el dispositivo del usuario
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icono.png',
    './logofirma.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2'
];

// --- 1. INSTALACIÓN: Descarga y almacenamiento en caché ---
self.addEventListener('install', (event) => {
    // Activa inmediatamente este Service Worker sin esperar a que el usuario cierre la app
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[Service Worker] Almacenando archivos para uso sin conexión...');
            // Guardamos cada recurso individualmente para evitar que un fallo puntual cancele la instalación
            for (const asset of STATIC_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (error) {
                    console.warn(`[Service Worker] Aviso: No se pudo precachear ${asset}:`, error);
                }
            }
        })
    );
});

// --- 2. ACTIVACIÓN: Limpieza de versiones obsoletas ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((existingCache) => {
                    if (existingCache !== CACHE_NAME) {
                        console.log(`[Service Worker] Eliminando caché antigua: ${existingCache}`);
                        return caches.delete(existingCache);
                    }
                })
            );
        }).then(() => {
            // Toma control inmediato de todas las pestañas y ventanas abiertas de la app
            return self.clients.claim();
        })
    );
});

// --- 3. FETCH: Gestión de peticiones (Online / Offline) ---
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Solo procesamos solicitudes HTTP/HTTPS con método GET
    if (request.method !== 'GET' || !request.url.startsWith('http')) {
        return;
    }

    // A. Navegación principal (Cargar la página) -> Estrategia Network-First con Fallback a Caché
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Si no hay internet, sirve el index.html guardado previamente
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    return caches.match('./index.html') || caches.match('./');
                })
        );
        return;
    }

    // B. Recursos estáticos (estilos, fuentes, iconos, imágenes) -> Estrategia Cache-First
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Servir instantáneamente desde la memoria local
                return cachedResponse;
            }

            // Si aún no está en caché, descargarlo y guardarlo para futuras sesiones sin conexión
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return networkResponse;
            }).catch(() => {
                return new Response('Recurso no disponible sin conexión', {
                    status: 503,
                    statusText: 'Offline'
                });
            });
        })
    );
});

// --- 4. MENSAJERÍA ---
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});