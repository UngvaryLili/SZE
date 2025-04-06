document.addEventListener("DOMContentLoaded", () => {
    const oktato = document.getElementById("oktato");
    const datum = document.getElementById("datum");
    const ido = document.getElementById("ido");
    const megjegyzes = document.getElementById("megjegyzes");
    const submitBtn = document.querySelector("button");

    let lastDatumValue = "";

    oktato.addEventListener("change", () => {
        const selected = oktato.value !== "";
        if (selected) {
            datum.removeAttribute("readonly");
            ido.removeAttribute("disabled");
            megjegyzes.removeAttribute("readonly");
            submitBtn.removeAttribute("disabled");

            //  Minimum dátum: holnap (helyi idő alapján)
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 nap
            const yyyyMin = tomorrow.getFullYear();
            const mmMin = String(tomorrow.getMonth() + 1).padStart(2, "0");
            const ddMin = String(tomorrow.getDate()).padStart(2, "0");
            datum.min = `${yyyyMin}-${mmMin}-${ddMin}`;

            //  Maximum dátum: 2025.06.27
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

    
    datum.addEventListener("change", () => {
        if (datum.value === lastDatumValue) return;
        lastDatumValue = datum.value;

        if (!datum.value) return;

        const [ev, ho, nap] = datum.value.split("-");
        const selectedDate = new Date(Date.UTC(Number(ev), Number(ho) - 1, Number(nap)));
        const day = selectedDate.getUTCDay(); // 0 = vasárnap, 6 = szombat

        if (day === 0) {
            alert("Vasárnapra nem lehet időpontot foglalni.");
            datum.value = "";
            ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
            return;
        }

        const selectedOktato = oktato.value;
        const idopontok = [];

        if (selectedOktato === "Horváth Gábor") {
            if (day === 6) {
                idopontok.push("09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00");
            } else {
                idopontok.push("16:00", "17:00", "18:00");
            }
        } else if (selectedOktato === "Kovács Sándor") {
            if (day === 6) {
                idopontok.push("10:00", "11:00", "12:00", "13:00");
            } else {
                idopontok.push("14:00", "15:00", "16:00", "17:00");
            }
        }

        ido.innerHTML = `<option value="">-- Válassz időpontot --</option>`;
        idopontok.forEach(i => {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = i;
            ido.appendChild(option);
        });
    });
});
