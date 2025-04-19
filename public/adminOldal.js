document.addEventListener("DOMContentLoaded", async () => {
    const foglalasokDiv = document.getElementById("admin-foglalasok");
    const template = document.getElementById("admin-foglalas-template");
    const elerhetoForm = document.getElementById("elerheto-idopont-form");
    const datumInput = document.getElementById("uj-datum");

    // ======= DÁTUM KORLÁTOZÁS: holnaptól 2025.06.27-ig, vasárnap kizárva =======
    const holnap = new Date();
    holnap.setDate(holnap.getDate() + 1);
    const év = holnap.getFullYear();
    const hónap = String(holnap.getMonth() + 1).padStart(2, '0');
    const nap = String(holnap.getDate()).padStart(2, '0');
    datumInput.min = `${év}-${hónap}-${nap}`;
    datumInput.max = "2025-06-27";

    datumInput.addEventListener("change", () => {
        const selected = new Date(datumInput.value);
        if (selected.getDay() === 0) {
            alert("Vasárnapra nem lehet időpontot beállítani!");
            datumInput.value = "";
        }
    });

    // ======= ÚJ IDŐPONT FELVÉTELE =======
    elerhetoForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const datum = document.getElementById("uj-datum").value;
        const ido = document.getElementById("uj-ido").value;
        const megjegyzes = document.getElementById("uj-megjegyzes").value;

        const selectedDate = new Date(datum);
        const ma = new Date();
        ma.setHours(0, 0, 0, 0);
        const maxDatum = new Date("2025-06-27");

        if (selectedDate <= ma) {
            alert("Mai vagy korábbi napra nem lehet időpontot kiírni.");
            return;
        }
        if (selectedDate > maxDatum) {
            alert("2025.06.27. utánra nem lehet időpontot kiírni.");
            return;
        }
        if (selectedDate.getDay() === 0) {
            alert("Vasárnapra nem lehet időpontot beállítani!");
            return;
        }

        // DUPLIKÁLT IDŐPONT ELLENŐRZÉS
        try {
            const ellenorzesRes = await fetch(`/admin-ellenorzes?datum=${datum}&ido=${ido}`);
            const exists = await ellenorzesRes.json();
            if (exists.marVan) {
                alert("Ez az időpont már hozzá lett adva.");
                return;
            }
        } catch (err) {
            alert("Hiba történt az időpont ellenőrzés során.");
            return;
        }

        // BEKÜLDÉS
        try {
            const res = await fetch("/admin-elerheto-idopont", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ datum, ido, megjegyzes })
            });

            const message = await res.text();
            if (res.ok) {
                alert("Időpont sikeresen hozzáadva.");
                elerhetoForm.reset();
                location.reload(); // frissítés a naptárhoz is
            } else {
                alert("Hiba: " + message);
            }
        } catch (err) {
            alert("Szerverhiba.");
        }
    });

    // ======= FOGLALÁSOK LEKÉRÉSE (kártyás megjelenítés) =======
    try {
        const res = await fetch("/admin-foglalasok");
        if (!res.ok) throw new Error("Nem sikerült a foglalások lekérése.");
        const foglalasok = await res.json();

        foglalasokDiv.innerHTML = "";

        if (foglalasok.length === 0) {
            foglalasokDiv.innerHTML = "<p>Jelenleg nincs hozzád tartozó foglalás.</p>";
        } else {
            foglalasok.forEach(f => {
                const datumObj = new Date(f.datum);
                const datumStr = `${datumObj.getFullYear()}.${(datumObj.getMonth() + 1).toString().padStart(2, '0')}.${datumObj.getDate().toString().padStart(2, '0')}`;

                let idoStr = "ismeretlen";
                if (typeof f.ido === "string") {
                    const match = f.ido.match(/T(\d{2}:\d{2})/);
                    if (match) {
                        idoStr = match[1];
                    } else if (f.ido.includes(":")) {
                        idoStr = f.ido.split(":").slice(0, 2).join(":");
                    }
                } else if (f.ido instanceof Date) {
                    idoStr = f.ido.getHours().toString().padStart(2, "0") + ":" + f.ido.getMinutes().toString().padStart(2, "0");
                }

                const card = template.content.cloneNode(true);
                card.querySelector(".datum").textContent = datumStr;
                card.querySelector(".ido").textContent = idoStr;
                card.querySelector(".email").textContent = f.email;
                card.querySelector(".megjegyzes").textContent = f.megjegyzes || "Nincs";
                card.querySelector(".cancel-btn").setAttribute("data-id", f.esemenyId);

                foglalasokDiv.appendChild(card);
            });
        }
    } catch (err) {
        foglalasokDiv.innerHTML = `<p class="error">${err.message}</p>`;
    }

    // ======= TÖRLÉS KEZELÉSE =======
    foglalasokDiv.addEventListener("click", async (e) => {
        if (e.target && e.target.classList.contains("cancel-btn")) {
            const esemenyId = e.target.getAttribute("data-id");
            if (confirm("Biztosan törölni szeretnéd ezt az időpontot?")) {
                try {
                    const res = await fetch("/admin-delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ esemenyId })
                    });

                    const message = await res.text();
                    if (res.ok) {
                        alert("Időpont sikeresen törölve.");
                        location.reload();
                    } else {
                        alert(message);
                    }
                } catch (error) {
                    alert("Hiba történt a törlés során.");
                }
            }
        }
    });

    // ======= FullCalendar heti nézet: oktató saját kiírt órái =======
    const calendarEl = document.getElementById("naptar");
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "timeGridWeek",
        slotMinTime: "08:00:00",
        slotMaxTime: "20:00:00",
        allDaySlot: false,
        height: "auto",
        locale: "hu",
        timeZone: "local", //időzóna eltolás az admin naptárnál
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "timeGridWeek"
        },
        events: async function (info, successCallback, failureCallback) {
            try {
                const res = await fetch("/admin-kiratasaim");
                const idopontok = await res.json();

                const esemenyek = idopontok.map(i => ({
                    title: i.title || "Kiírt óra",
                    start: i.start,
                    end: i.end,
                    allDay: false,
                    color: "#008000"
                }));

                successCallback(esemenyek);
            } catch (err) {
                console.error("Hiba a kiírt órák betöltésekor:", err);
                failureCallback(err);
            }
        }
    });

    calendar.render();
});
