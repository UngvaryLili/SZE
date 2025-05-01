document.addEventListener("DOMContentLoaded", async () => {
    const oktatoSelect = document.getElementById("oktato");
    const datum = document.getElementById("datum");
    const ido = document.getElementById("ido");
    const megjegyzes = document.getElementById("megjegyzes");
    const submitBtn = document.querySelector("button");
    const racs = document.getElementById("idopont-racs");

    // Oktatók betöltése
    try {
        const response = await fetch("/oktatok");
        const teachers = await response.json();
        oktatoSelect.innerHTML = `<option value="">-- Válassz oktatót --</option>`;
        teachers.forEach(teacher => {
            const option = document.createElement("option");
            option.value = teacher.oktatokId;
            option.textContent = teacher.nev;
            oktatoSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Hiba az oktatók lekérésekor:", error);
    }

    oktatoSelect.addEventListener("change", () => {
        const selected = oktatoSelect.value !== "";
        datum.value = "";
        ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
        racs.innerHTML = "";

        if (selected) {
            datum.removeAttribute("readonly");
            ido.removeAttribute("disabled");
            megjegyzes.removeAttribute("readonly");
            submitBtn.removeAttribute("disabled");

            const now = new Date();
            let minDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            if (now.getHours() >= 16) {
                minDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            }
            const yyyyMin = minDate.getFullYear();
            const mmMin = String(minDate.getMonth() + 1).padStart(2, "0");
            const ddMin = String(minDate.getDate()).padStart(2, "0");
            datum.min = `${yyyyMin}-${mmMin}-${ddMin}`;
            datum.max = "2025-06-27";
        } else {
            datum.setAttribute("readonly", true);
            ido.setAttribute("disabled", true);
            megjegyzes.setAttribute("readonly", true);
            submitBtn.setAttribute("disabled", true);
        }
    });

    datum.addEventListener("change", async () => {
        if (!datum.value) return;

        const selectedDate = new Date(datum.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate <= today) {
            alert("Mai vagy múltbeli napra nem lehet időpontot foglalni.");
            datum.value = "";
            ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
            racs.innerHTML = "";
            return;
        }

        if (selectedDate.getDay() === 0) {
            alert("Vasárnapra nem lehet időpontot foglalni.");
            datum.value = "";
            ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
            racs.innerHTML = "";
            return;
        }

        const selectedOktatoId = parseInt(oktatoSelect.value);

        try {
            const elerhetoRes = await fetch(`/elerheto-idopontok?oktatokId=${selectedOktatoId}&datum=${datum.value}`);
            const elerhetoIdopontok = await elerhetoRes.json();

            const foglaltRes = await fetch(`/foglalt-idopontok?oktatokId=${selectedOktatoId}&datum=${datum.value}`);
            const foglaltRaw = await foglaltRes.json();

            const foglaltIdopontok = foglaltRaw.map(idopont => {
                const d = new Date(idopont);
                return d.toISOString().substring(11, 16);
            });

            ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
            racs.innerHTML = "";

            elerhetoIdopontok.forEach(t => {
                const option = document.createElement("option");
                option.value = t;
                option.textContent = t;
                if (foglaltIdopontok.includes(t)) {
                    option.disabled = true;
                    option.textContent += " (foglalt)";
                }
                ido.appendChild(option);

                const box = document.createElement("div");
                box.classList.add("idopont");
                box.textContent = t;
                if (foglaltIdopontok.includes(t)) {
                    box.classList.add("foglalt");
                    box.title = "Ez az időpont már foglalt.";
                } else {
                    box.classList.add("szabad");
                    box.title = "Ez az időpont szabad.";
                }
                racs.appendChild(box);
            });

        } catch (err) {
            console.error("Nem sikerült lekérni az időpontokat:", err);
        }
    });

    const form = document.querySelector("form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const body = {};
        for (let [key, value] of formData.entries()) {
            body[key] = value;
        }

        try {
            const res = await fetch("/foglalas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (res.redirected) {
                window.location.href = res.url;
            } else {
                const text = await res.text();
                alert(text);
            }
        } catch (err) {
            alert("Hiba történt a foglalás során.");
        }
    });

    async function getUserEmail() {
        try {
            const res = await fetch("/profiladatok");
            if (!res.ok) return null;
            const data = await res.json();
            return data.email;
        } catch (err) {
            console.error("Nem sikerült lekérni az email címet:", err);
            return null;
        }
    }

    async function lekerFoglalasokNaptarhoz(userEmail) {
        try {
            const res = await fetch("/osszes-foglalas");
            if (!res.ok) throw new Error("Nem sikerült foglalásokat lekérni.");
            const foglalasok = await res.json();

            return foglalasok.map(f => {
                const datum = f.datum.split("T")[0];
                const ido = f.ido.split("T")[1].substring(0, 5);
                const start = `${datum}T${ido}:00`;

                return {
                    title: f.oktato || "Foglalás",
                    start,
                    end: start,
                    color: f.email === userEmail ? "#007bff" : "#dc3545",
                    sajat: f.email === userEmail,
                    foglalt: true
                };
            });
        } catch (err) {
            console.error("Naptár foglalás hiba:", err);
            return [];
        }
    }

    async function lekerElerhetoIdopontok() {
        try {
            const res = await fetch("/osszes-elerheto-idopont");
            if (!res.ok) throw new Error("Nem sikerült a szabad időpontokat lekérni.");
            const idopontok = await res.json();

            return idopontok.map(f => {
                const datum = f.datum.split("T")[0];
                const ido = f.ido.split(":").slice(0, 2).join(":");
                const start = `${datum}T${ido}:00`;

                return {
                    title: f.oktato || "Szabad időpont",
                    start,
                    end: start,
                    color: "#28a745",
                    foglalt: false,
                    datum,
                    ido,
                    oktatokId: f.oktatokId
                };
            });
        } catch (err) {
            console.error("Szabad időpont hiba:", err);
            return [];
        }
    }

    async function initNaptar() {
        const calendarEl = document.getElementById("naptar");
        const userEmail = await getUserEmail();
        const foglaltak = await lekerFoglalasokNaptarhoz(userEmail);
        const szabadok = await lekerElerhetoIdopontok();

        const foglaltKulcsok = new Set(foglaltak.map(e => `${e.start}-${e.title}`));
        const osszes = [...foglaltak];
        szabadok.forEach(szabad => {
            const kulcs = `${szabad.start}-${szabad.title}`;
            if (!foglaltKulcsok.has(kulcs)) {
                osszes.push(szabad);
            }
        });


        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            locale: 'hu',
            height: 420,
            contentHeight: 400,
            aspectRatio: 1.6,
            allDaySlot: false,
            slotMinTime: "09:00:00",
            slotMaxTime: "19:00:00",
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            events: osszes,
            eventClick: function (info) {
                const sajat = info.event.extendedProps?.sajat;
                const foglalt = info.event.extendedProps?.foglalt;

                if (sajat) {
                    alert("Ez a saját foglalásod!");
                } else if (foglalt) {
                    alert("Ez az időpont már foglalt.");
                } else {
                    alert("Ez egy szabad időpont – válaszd ki az űrlapon, ha szeretnél foglalni.");
                }
            }
        });

        calendar.render();
    }

    await initNaptar();
});
