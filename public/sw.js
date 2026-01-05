const CACHE_NAME = 'austamgood-wms-v2';
const API_CACHE_NAME = 'austamgood-wms-api-v1';
const OFFLINE_URL = '/mobile/login';

const STATIC_ASSETS = [
  '/',
  '/mobile',
  '/mobile/receive',
  '/mobile/transfer',
  '/mobile/pick',
  '/mobile/loading',
  '/mobile/pick-up-pieces',
  OFFLINE_URL,
];

const CACHEABLE_API_PATTERNS = [
  '/api/master-location',
  '/api/inventory/balances',
  '/api/mobile/replenishment/tasks',
  '/api/moves',
  '/api/employees',
];

const API_CACHE_DURATION = 60 * 60 * 1000;

self.addEventListener('install', function(event) {
  console.log('Service Worker v2 installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker v2 activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method === 'POST' || request.method === 'PATCH') {
    event.respondWith(handleMutationRequest(request));
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleStaticRequest(request));
});

function handleApiRequest(request) {
  var url = new URL(request.url);
  var isCacheable = CACHEABLE_API_PATTERNS.some(function(pattern) {
    return url.pathname.startsWith(pattern);
  });

  if (!isCacheable) {
    return fetch(request).catch(function() {
      return new Response(JSON.stringify({ error: 'Network unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }

  return fetch(request).then(function(networkResponse) {
    if (networkResponse.ok) {
      var responseToCache = networkResponse.clone();
      caches.open(API_CACHE_NAME).then(function(cache) {
        cache.put(request, responseToCache);
      });
    }
    return networkResponse;
  }).catch(function() {
    return caches.open(API_CACHE_NAME).then(function(cache) {
      return cache.match(request).then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });
  });
}

function handleMutationRequest(request) {
  return fetch(request.clone()).catch(function() {
    return request.clone().json().then(function(body) {
      return queueForSync({
        url: request.url,
        method: request.method,
        headers: {},
        data: body,
        timestamp: Date.now(),
        retryCount: 0
      }).then(function() {
        return new Response(JSON.stringify({ success: true, queued: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      });
    }).catch(function() {
      return new Response(JSON.stringify({ error: 'Cannot save offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });
}

function handleNavigationRequest(request) {
  return fetch(request).catch(function() {
    return caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return caches.match(OFFLINE_URL);
    });
  });
}

function handleStaticRequest(request) {
  return caches.match(request).then(function(cachedResponse) {
    if (cachedResponse) {
      return cachedResponse;
    }
    return fetch(request).then(function(response) {
      if (response.ok && response.type === 'basic') {
        var responseToCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, responseToCache);
        });
      }
      return response;
    }).catch(function() {
      if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
        return caches.match(OFFLINE_URL);
      }
    });
  });
}

function queueForSync(item) {
  return openIndexedDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('syncQueue', 'readwrite');
      var store = tx.objectStore('syncQueue');
      var request = store.add(item);
      request.onsuccess = function() { resolve(); };
      request.onerror = function() { reject(request.error); };
    });
  });
}

self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-mobile-actions') {
    event.waitUntil(syncPendingActions());
  }
});

function syncPendingActions() {
  return openIndexedDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('syncQueue', 'readonly');
      var store = tx.objectStore('syncQueue');
      var request = store.getAll();
      request.onsuccess = function() {
        var pendingActions = request.result || [];
        var syncPromises = pendingActions.map(function(action) {
          return fetch(action.url, {
            method: action.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
          }).then(function(response) {
            if (response.ok || response.status === 409 || response.status === 400) {
              return removeFromSyncQueue(db, action.id);
            }
          }).catch(function(error) {
            console.error('Sync failed for action:', action.id, error);
          });
        });
        Promise.all(syncPromises).then(function() {
          notifyClients();
          resolve();
        });
      };
      request.onerror = function() { reject(request.error); };
    });
  });
}

function removeFromSyncQueue(db, id) {
  return new Promise(function(resolve, reject) {
    var tx = db.transaction('syncQueue', 'readwrite');
    var store = tx.objectStore('syncQueue');
    var request = store.delete(id);
    request.onsuccess = function() { resolve(); };
    request.onerror = function() { reject(request.error); };
  });
}

function notifyClients() {
  self.clients.matchAll().then(function(clientList) {
    clientList.forEach(function(client) {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
  });
}

function openIndexedDB() {
  return new Promise(function(resolve, reject) {
    var request = indexedDB.open('mobile-wms-db', 2);
    request.onerror = function() { reject(request.error); };
    request.onsuccess = function() { resolve(request.result); };
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        var store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('palletCache')) {
        var store2 = db.createObjectStore('palletCache', { keyPath: 'pallet_id' });
        store2.createIndex('expires_at', 'expires_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('locationCache')) {
        var store3 = db.createObjectStore('locationCache', { keyPath: 'location_id' });
        store3.createIndex('location_code', 'location_code', { unique: false });
      }
      if (!db.objectStoreNames.contains('replenishmentTasks')) {
        var store4 = db.createObjectStore('replenishmentTasks', { keyPath: 'queue_id' });
        store4.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('pendingMoves')) {
        var store5 = db.createObjectStore('pendingMoves', { keyPath: 'local_id' });
        store5.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'TRIGGER_SYNC') {
    syncPendingActions();
  }
});
