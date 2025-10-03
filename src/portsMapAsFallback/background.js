importScripts("./scanner.js");




// const CORPRES_HOST_IP = "185.63.188.147";
//
// // Параметры сканера (можно вынести в настройки)
// const SCAN_PORTS_FROM = 3000;
// const SCAN_PORTS_TO = 3030;
// const SCAN_CONCURRENCY = 60;
// const SCAN_TIMEOUT = 3000; // таймаут на каждый порт
// const SCAN_RES_TTL = 5 * 60 * 1000; // 5 минут (TTL кэша)
const { CORPRES_HOST_IP, SCAN_PORTS_FROM, SCAN_PORTS_TO, SCAN_CONCURRENCY, SCAN_TIMEOUT, SCAN_RES_TTL } = process.env;
const EXPECTED_ERRORS = [
  // Если всё-таки всех ошибки данных ниже не достаточно, чтобы покрыть каждый кейс,
  //    то лучше всего использовать просто "net::" который будет указывать на все ошибки
  "ERR_ABORTED",
  "ERR_CONNECTION_FAILED",
  "ERR_TUNNEL_CONNECTION_FAILED",
  "ERR_CONNECTION_REFUSED"
]


const readLocalStorage = async (key) => {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], function (result) {
        resolve(result[key]);
    });
  });
};

// Отслеживаем ошибки запросов
chrome.webRequest.onErrorOccurred.addListener(async (details) => {
  try {
    if (!details || !details.url) return;
    const url = new URL(details.url);
    const host = url.hostname;

    if (host !== CORPRES_HOST_IP) return;

    const err = details.error || "";
    if (EXPECTED_ERRORS.find((errStr)=>err.includes(errStr))) {
      console.log("Detected connection error for host", host, err);
      const existedPort = await readLocalStorage("startedEventPort");
      if (existedPort == url.port) {return}
      else if ((existedPort !== undefined || existedPort !== null) && Number(url.port) >= SCAN_PORTS_FROM && Number(url.port) <= SCAN_PORTS_TO) {return}
      await chrome.storage.local.set({ "startedEventPort": url.port});

      // Проверяем кэш
      const lastScan = await readLocalStorage(`lastScan_${host}`);
      const now = Date.now();
      let scanId;

      if (lastScan && (now - lastScan.timestamp) < SCAN_RES_TTL) {
        console.log("Using cached scan results for", host);
        scanId = lastScan.scanId;
      } else {
        // Запускаем новый скан
        scanId = `scan_${now}`;
        await chrome.storage.local.set({ [scanId]: { status: "scanning", host, from: SCAN_PORTS_FROM, to: SCAN_PORTS_TO }});

        const result = await scanPorts(host, SCAN_PORTS_FROM, SCAN_PORTS_TO, {
          SCAN_CONCURRENCY: SCAN_CONCURRENCY,
          timeout: SCAN_TIMEOUT
        });

        await chrome.storage.local.set({
          [scanId]: {
            status: "done",
            host,
            from: SCAN_PORTS_FROM,
            to: SCAN_PORTS_TO,
            result,
            timestamp: now
          },
          [`lastScan_${host}`]: { scanId, timestamp: now }
        });
      }

      await chrome.storage.local.set({ ["startedEventPort"]: null});
      // Показываем results.html
      const resultsPage = chrome.runtime.getURL(`results.html?scan=${encodeURIComponent(scanId)}`);
      if (details.tabId && details.tabId !== -1) {
        chrome.tabs.update(details.tabId, { url: resultsPage });
      } else {
        chrome.tabs.create({ url: resultsPage });
      }
    }
  } catch (e) {
    console.error("Error in onErrorOccurred handler:", e);
  }
}, { urls: ["<all_urls>"] });
