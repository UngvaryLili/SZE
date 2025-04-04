document.addEventListener("DOMContentLoaded", async () => {
    const foglalasokDiv = document.getElementById("foglalasok");

    // PROFIL BETÖLTÉS
    const profilBox = document.createElement("div");
    profilBox.className = "profile-box";
    foglalasokDiv.parentNode.insertBefore(profilBox, foglalasokDiv);

    try {
        const profilRes = await fetch("/profiladatok");
        if (!profilRes.ok) throw new Error("Nem sikerült a profiladatok lekérése.");

        const profil = await profilRes.json();

        profilBox.innerHTML = `
            <h2><i class="fas fa-user"></i> Profil</h2>
            <div class="profil-sor"><span class="cimke">Email:</span> ${profil.email}</div>
            <div class="profil-sor"><span class="cimke">Felhasználónév:</span> ${profil.username}</div>
        `;
    } catch (err) {
        profilBox.innerHTML = `<p class="error">${err.message}</p>`;
    }

    // FOGLALÁSOK BETÖLTÉSE
    try {
        const res = await fetch("/foglalasaim");
        if (!res.ok) throw new Error("Hiba a foglalások lekérésekor.");

        const foglalasok = await res.json();
        foglalasokDiv.innerHTML = "";

        if (foglalasok.length === 0) {
            foglalasokDiv.innerHTML = "<p>Nincs még foglalásod.</p>";
        } else {
            foglalasok.forEach(f => {
                // Dátum formázása
                const datum = new Date(f.datum);
                const datumStr = `${datum.getFullYear()}.${(datum.getMonth() + 1).toString().padStart(2, '0')}.${datum.getDate().toString().padStart(2, '0')}`;

                // Időpont formázása
                let idoStr = "ismeretlen";
                if (typeof f.ido === "string") {
                    const match = f.ido.match(/T(\d{2}:\d{2})/);
                    if (match) {
                        idoStr = match[1];
                    } else if (f.ido.includes(":")) {
                        idoStr = f.ido.split(":").slice(0, 2).join(":");
                    }
                }

                // Foglalás kártya
                const card = document.createElement("div");
                card.className = "card";
                card.innerHTML = `
                    <p><strong>Dátum:</strong> ${datumStr}</p>
                    <p><strong>Idő:</strong> ${idoStr}</p>
                    <p><strong>Oktató:</strong> ${f.oktato}</p>
                    <p><strong>Megjegyzés:</strong> ${f.megjegyzes || "Nincs"}</p>
                `;
                foglalasokDiv.appendChild(card);
            });
        }
    } catch (err) {
        foglalasokDiv.innerHTML = `<p class="error">${err.message}</p>`;
    }
});
