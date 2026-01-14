// Название кэша. Меняй цифру, когда обновляешь файлы (например, v2, v3...)
const CACHE_NAME = 'calculator-cache-v1';

// Сколько ждать ответа от интернета (в миллисекундах)
const NETWORK_TIMEOUT = 500; // 0.5 секунды

// Какие файлы сохранить сразу при установке приложения
const FILES_TO_CACHE = [
  './',           // Главная страница (index.html)
  'index.html',
  'style.css',
  'logo192.jpg',
  'logo512.png'
];

// Функция: попробовать загрузить ресурс из интернета с таймаутом
async function fetchWithTimeout(request, timeoutMs) {
  // Создаём промис, который завершится ошибкой через timeoutMs миллисекунд
  const timeoutPromise = new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(new Error('Слишком долго грузится'));
    }, timeoutMs);
  });

  // Одновременно пытаемся загрузить из интернета И ждать таймаут
  // Первый завершившийся результат "победит"
  return Promise.race([
    fetch(request),       // Запрос в интернет
    timeoutPromise        // Таймер на 0.5 сек
  ]);
}

// Основная функция: как отвечать на запрос
async function handleRequest(request) {
  // Открываем наше хранилище (кэш)
  const cache = await caches.open(CACHE_NAME);

  try {
    // Пробуем загрузить файл из интернета (но не дольше 0.5 сек)
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT);

    // Если получили хороший ответ — сохраним его в кэш
    if (networkResponse && networkResponse.status === 200) {
      // .clone() нужен, потому что response можно прочитать только один раз
      await cache.put(request, networkResponse.clone());
    }

    // Отдаём свежий ответ из интернета
    return networkResponse;

  } catch (error) {
    // Если интернет не ответил — берём из кэша
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Если даже в кэше нет — для HTML отдаём главную страницу
    if (request.destination === 'document') {
      const fallbackPage = await cache.match('index.html');
      if (fallbackPage) {
        return fallbackPage;
      }
    }

    // Совсем ничего нет — ошибка
    return new Response('Нет интернета и нет кэша', { status: 500 });
  }
}

// 1. Когда браузер устанавливает Service Worker
self.addEventListener('install', function (event) {
  // Говорим браузеру: "подожди, пока мы всё сохраним"
  event.waitUntil(
    (async function () {
      // Открываем кэш
      const cache = await caches.open(CACHE_NAME);
      // Сохраняем все нужные файлы
      await cache.addAll(FILES_TO_CACHE);
      // Активируем Service Worker сразу
      self.skipWaiting();
    })()
  );
});

// 2. Когда Service Worker становится активным
self.addEventListener('activate', function (event) {
  // Говорим браузеру: "подожди, пока мы почистим старые кэши"
  event.waitUntil(
    (async function () {
      // Получаем список всех кэшей
      const cacheNames = await caches.keys();
      // Удаляем все, кроме нашего
      for (var i = 0; i < cacheNames.length; i++) {
        var cacheName = cacheNames[i];
        if (cacheName !== CACHE_NAME) {
          await caches.delete(cacheName);
        }
      }
      // Этот Service Worker теперь управляет всеми вкладками
      self.clients.claim();
    })()
  );
});

// 3. Когда запрашивается файл (HTML, CSS, картинка и т.д.)
self.addEventListener('fetch', function (event) {
  // Пропускаем запросы к другим сайтам
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Обрабатываем только GET-запросы
  if (event.request.method !== 'GET') {
    return;
  }

  // Перехватываем запрос и сами решаем, что отдать
  event.respondWith(handleRequest(event.request));
});
