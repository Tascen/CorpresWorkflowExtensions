// scanner.js
// Функции доступны в глобальном scope service worker

/**
 * Проверяет порт: делает HTTP GET на http://host:port/ и определяет,
 * вернулся ли HTML (Content-Type содержит text/html или тело содержит <html).
 *
 * Возвращает { port: N, ok: boolean, status: statusOrError, contentType: string|null }
 */
async function checkPort(host, port, timeoutMs = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const url = `http://${host}:${port}/`;
  try {
    const resp = await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
    // Внимание: при mode: 'no-cors' response будет opaqueresponse, нельзя читать body.
    // Для расширений иногда можно использовать fetch без no-cors, если в manifest указаны host_permissions.
    // Попробуем сначала обычный fetch (CORS разрешен для расширений при host_permissions) — если упадёт, fallback на no-cors.
  } catch (e) {
    clearTimeout(id);
    return { port, ok: false, status: e.message || 'fetch error', contentType: null };
  } finally {
    // nothing here
  }

  // Попробуем корректный способ — делать fetch с попыткой прочесть заголовки и тело.
  clearTimeout(id);
  const controller2 = new AbortController();
  const id2 = setTimeout(() => controller2.abort(), timeoutMs);
  try {
    const resp = await fetch(`http://${host}:${port}/`, { signal: controller2.signal, cache: 'no-store' });
    const ct = resp.headers.get('content-type');
    let bodyContainsHtml = false;
    let sample = null;
    if (resp.ok) {
      // Пытаемся прочитать небольшой фрагмент текста (ограничим до 8192 символов)
      const txt = await resp.text();
      sample = txt.slice(0, 8192).toLowerCase();
      if (ct && ct.includes('text/html')) bodyContainsHtml = true;
      if (!bodyContainsHtml && sample.includes('<html')) bodyContainsHtml = true;
    }
    clearTimeout(id2);
    return { port, ok: resp.ok && bodyContainsHtml, status: resp.status + ' ' + resp.statusText, contentType: ct, sample: sample ? sample.slice(0,500) : null };
  } catch (e) {
    clearTimeout(id2);
    return { port, ok: false, status: e.message || 'fetch error', contentType: null };
  }
}

/**
 * scanPorts(host, from, to, opts)
 * - concurrency (число одновременных запросов)
 * - timeout (ms)
 *
 * Возвращает массив объектов {port, ok, status, contentType}
 */
async function scanPorts(host, from, to, opts = {}) {
  const concurrency = opts.concurrency || 30;
  const timeout = opts.timeout || 3000;
  const ports = [];
  for (let p = from; p <= to; p++) ports.push(p);

  const results = [];
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= ports.length) break;
      const port = ports[i];
      try {
        const r = await checkPort(host, port, timeout);
        results.push(r);
      } catch (e) {
        results.push({ port, ok: false, status: e.message || 'error', contentType: null });
      }
    }
  }

  const workers = [];
  const actualConcurrency = Math.min(concurrency, ports.length);
  for (let i = 0; i < actualConcurrency; i++) workers.push(worker());
  await Promise.all(workers);

  // Сортируем по порту
  results.sort((a, b) => a.port - b.port);
  return results;
}



// Данные ниже присвоения аналог export,
//    но который будет работать с командой importScripts
globalThis["checkPort"] = checkPort;
globalThis["scanPorts"] = scanPorts;
