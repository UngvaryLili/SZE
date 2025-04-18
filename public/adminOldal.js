document.addEventListener("DOMContentLoaded", async () => {

    const foglalasokDiv = document.getElementById("admin-foglalasok");
    const template = document.getElementById("admin-foglalas-template");

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
                const datumStr = `${datumObj.getFullYear()}.${(datumObj.getMonth() + 1)
                    .toString().padStart(2, '0')}.${datumObj.getDate().toString().padStart(2, '0')}`;

                let idoStr = "ismeretlen";
                if (typeof f.ido === "string") {
                    const match = f.ido.match(/T(\d{2}:\d{2})/);
                    if (match) {
                        idoStr = match[1];
                    } else if (f.ido.includes(":")) {
                        idoStr = f.ido.split(":").slice(0, 2).join(":");
                    }
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

    // Törlés gomb kezelése
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
});
