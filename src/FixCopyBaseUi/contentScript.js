(()=>{
  console.log("FixCopyBaseUi<Fix Copy Base Ui>");

  

  (function fixRowsInTableOnPageUpdateProtocol() {
    if (!location.href.includes("/Logs")) {return}

    const style = document.createElement("style");
    style.innerHTML = `
      #logTbl.dataTable > tbody > tr:hover {
        /* background-color: #f5f5f5; */
        background-color: #e9e9e9;
      }
      #logTbl.dataTable > tbody > tr:nth-of-type(odd):hover {
        background-color: #e9e9e9;
      }
    `
    document.body.appendChild(style);
  })();

  (function fixRowsInTableOnPageUpdateProtocol() {
    if (!location.href.includes("/Logs")) {return}

    const INJECTED_VALUE =">9<";

    const dateRangeSelectEle = document.getElementById("Interval");
    const newOptionEle = dateRangeSelectEle.children[Math.floor(dateRangeSelectEle.children.length / 2)].cloneNode(false);
    const style = document.createElement("style");

    style.innerHTML = `
      :root {
          --cwt--radius: 15px;
          --cwt--diametr: calc(var(--cwt--radius) * 2);
          --cwt--time: 2000ms;
      }
      tbody:has(#logTbl_loader) {
        display: flex !important;
        height: calc(var(--cwt--diametr) * 2);
      }
      #logTbl_loader {
        transform: translateY(var(--cwt--diametr));
      }
      #logTbl_loader {
          width: calc(1 * var(--cwt--diametr));
          height: calc(1 * var(--cwt--diametr));
          position: absolute;
          top: 50%;
          left: 50%;
          margin-top: calc(-1 * var(--cwt--diametr) / 2);
          margin-left: calc(-1 * var(--cwt--diametr) / 2);
          border: calc(1 * var(--cwt--diametr) / 10) solid #3333331f;
          border-radius: 50%;

          &:before,
          &:after {
            content: "";
            position: absolute;
            display: block;
            width: calc(1 * var(--cwt--diametr) / 10);
            background-color: #3333331f;
            border-radius: calc(1 * var(--cwt--diametr) / 10 / 2);
            transform-origin: 50% 0%;
            margin-left: -10%;
            margin-top: -2%;
            z-index: 23;
          }

          &:before {
            height: calc(var(--cwt--radius) - (1 * var(--cwt--diametr) / 10) * 2);
            left: calc(var(--cwt--radius) - (1 * var(--cwt--diametr) / 10 / 2));
            top: 50%;
            animation: spin var(--cwt--time) linear infinite;
          }

          &:after {
            height:  calc(var(--cwt--radius) - (1 * var(--cwt--diametr) / 10));
            left:  calc(var(--cwt--radius) - (1 * var(--cwt--diametr) / 10 / 2));
            top: 50%;
            animation: spin calc(var(--cwt--time) / 4) linear infinite;
          }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
    document.body.appendChild(style);

    newOptionEle.value = INJECTED_VALUE;
    newOptionEle.innerHTML = "Этот и прошлый год";
    dateRangeSelectEle.appendChild(newOptionEle);

    dateRangeSelectEle.addEventListener("change", (event)=>{
      if (event.target.value !== INJECTED_VALUE) {return}

      event.preventDefault();
      event.stopPropagation();

      (async function fetchAndInjectLogs() {
        try {
          const targetTbody = document.querySelector("table[id='logTbl'] tbody");

          // Регулярные выражения ниже парсят, текущий url адрес страницы,
          //    который виглядит так: https://copybase.ru/Logs?Interval=4&regNumber=
          const urls = [
            // URl адрес указывающий на верстку с этим годом
            location.href.replace(/(?<=\?).*Interval=[0-9]{0,}/, `Interval=${6}`),
            // URl адрес указывающий на верстку с прошлым годом
            location.href.replace(/(?<=\?).*Interval=[0-9]{0,}/, `Interval=${8}`),
          ];

          targetTbody.innerHTML = "<div id='logTbl_loader'></div>";
          const responses = await Promise.all(urls.map(url => fetch(url)));
          const htmlTexts = await Promise.all(responses.map(res => res.text()));
          // const targetTbody = document.querySelector("table[id='logTbl'] tbody");

          targetTbody.innerHTML = "";
          htmlTexts.forEach((html, i) => {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = html;
            targetTbody.innerHTML += wrapper.querySelector("table[id='logTbl'] tbody").innerHTML;
          });
        } catch (err) {
          console.error("Ошибка при получении логов:", err);
        }
      })()
    });
  })();


})()
