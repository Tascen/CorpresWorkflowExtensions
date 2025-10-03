(function () {
  const urlParams = new URLSearchParams(location.search);
  const scanId = urlParams.get("scan");

  chrome.storage.local.get([scanId], (data) => {
    if (!data[scanId] || !data[scanId].result) return;

    const scan = data[scanId];
    const metaDiv = document.getElementById("meta");
    const statusDiv = document.getElementById("status");
    const tbody = document.querySelector("#table tbody");

    function render() {
      const showActive = document.getElementById("filter-active").checked;
      const showInactive = document.getElementById("filter-inactive").checked;
      const showFresh = document.getElementById("filter-fresh").checked;
      const showStale = document.getElementById("filter-stale").checked;

      tbody.innerHTML = "";
      if (!scan.result) {
        statusDiv.textContent = "Результат ещё не готов или не найден.";
        return;
      }
      metaDiv.innerHTML = `<p>Host: <strong>${scan.host}</strong> (порты ${scan.from}–${scan.to})</p>`;
      if (scan.result.status === "scanning") {
        statusDiv.textContent = "Сканирование в процессе...";
        setTimeout(loadAndRender, 1000);
        return;
      }
      statusDiv.textContent = "Сканирование завершено.";
      const results = scan.result || [];
      let avail = 0;
      for (const portInfo of results) {
        const tr = document.createElement("tr");
        const ok = portInfo.open ? "Доступен" : "Недоступен";
        if (portInfo.open) avail++;
        const url = `http://${scan.host}:${portInfo.port}/`;
        tr.innerHTML = `
          <td>${portInfo.port}</td>
            <td>${ok}</td>
            <td>${portInfo.status}</td>
            <td><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>
          </td>
        `;
        tbody.appendChild(tr);
      }
      document.getElementById("summary").innerHTML = `
        <p>Найдено доступных портов: ${avail} из ${results.length}</p>
      `;
    }

    document.querySelectorAll(".filters input").forEach(el => {
      el.addEventListener("change", render);
    });

    render();
  });
})()
