document.addEventListener("DOMContentLoaded", async () => {
    // Elemszedések
    const oktatoSelect = document.getElementById("oktato");
    const datum = document.getElementById("datum");
    const ido = document.getElementById("ido");
    const megjegyzes = document.getElementById("megjegyzes");
    const submitBtn = document.querySelector("button");

    // Dinamikus oktató lista betöltése a szerver /oktatok végpontjáról
    try {
        const response = await fetch("/oktatok");
        const teachers = await response.json();
        // Töröljük az esetleges korábbi opciókat, majd feltöltjük a listát
        oktatoSelect.innerHTML = `<option value="">-- Válassz oktatót --</option>`;
        teachers.forEach(teacher => {
            const option = document.createElement("option");
            option.value = teacher.oktatokId;    // például "2" vagy "3"
            option.textContent = teacher.nev;     // pl.: "Horváth Gábor", "Kovács Sándor"
            oktatoSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Hiba az oktatók lekérésekor:", error);
    }

    let lastDatumValue = "";

    // Oktató kiválasztásának eseménye: ha van választás, engedélyezzük a többi mezőt és beállítjuk a dátum min/max értékét
    oktatoSelect.addEventListener("change", () => {
        const selected = oktatoSelect.value !== "";
        if (selected) {
            datum.removeAttribute("readonly");
            ido.removeAttribute("disabled");
            megjegyzes.removeAttribute("readonly");
            submitBtn.removeAttribute("disabled");

            // Minimum dátum: holnap (helyi idő alapján)
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 nap
            const yyyyMin = tomorrow.getFullYear();
            const mmMin = String(tomorrow.getMonth() + 1).padStart(2, "0");
            const ddMin = String(tomorrow.getDate()).padStart(2, "0");
            datum.min = `${yyyyMin}-${mmMin}-${ddMin}`;
            // Maximum dátum: fix érték, pl. 2025-06-27
            datum.max = "2025-06-27";
        } else {
            datum.setAttribute("readonly", true);
            ido.setAttribute("disabled", true);
            megjegyzes.setAttribute("readonly", true);
            submitBtn.setAttribute("disabled", true);
        }
        datum.value = "";
        ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
    });

    // Amikor a dátum megváltozik, állítsuk be a lehetséges időpontokat az oktató és a nap alapján
    datum.addEventListener("change", () => {
        if (datum.value === lastDatumValue) return;
        lastDatumValue = datum.value;
        if (!datum.value) return;

        // Dátum darabolása
        const [ev, ho, nap] = datum.value.split("-");
        const selectedDate = new Date(Date.UTC(Number(ev), Number(ho) - 1, Number(nap)));
        const day = selectedDate.getUTCDay(); // 0 = vasárnap, 6 = szombat

        if (day === 0) {
            alert("Vasárnapra nem lehet időpontot foglalni.");
            datum.value = "";
            ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
            return;
        }

        // Most a kiválasztott oktató ID-t használjuk
        const selectedOktatoId = parseInt(oktatoSelect.value);
        const idopontok = [];

        // Feltételezzük, hogy:
        // - "Horváth Gábor" oktatóId = 2
        // - "Kovács Sándor" oktatóId = 3
        if (selectedOktatoId === 2) {
            if (day === 6) {
                idopontok.push("09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00");
            } else {
                idopontok.push("16:00", "17:00", "18:00");
            }
        } else if (selectedOktatoId === 3) {
            if (day === 6) {
                idopontok.push("10:00", "11:00", "12:00", "13:00");
            } else {
                idopontok.push("14:00", "15:00", "16:00", "17:00");
            }
        } else {
            // Ha más oktató lesz majd, ezt is lehet kezelni itt
            idopontok.push("09:00", "10:00", "11:00", "12:00"); 
        }

        ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
        idopontok.forEach(t => {
            const option = document.createElement("option");
            option.value = t;
            option.textContent = t;
            ido.appendChild(option);
        });
    });
});
