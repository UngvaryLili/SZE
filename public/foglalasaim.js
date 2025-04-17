document.addEventListener("DOMContentLoaded", async () => {
    const foglalasokDiv = document.getElementById("foglalasok");
  
    // Profil adatok megjelenítése
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
  
    // Foglalások lekérése és megjelenítése
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
          const datumStr = `${datum.getFullYear()}.${(datum.getMonth() + 1)
            .toString().padStart(2, '0')}.${datum.getDate().toString().padStart(2, '0')}`;
  
          // Időpont formázása: Ha az adatbázisból stringként érkezne, alkalmazható a split,
          // de ha például a TIME(7) típus miatt objektumként jön, itt csak feltételezzük a string formátumot.
          // Ha szükséges, ezt is adaptálhatod úgy, hogy ellenőrizd a típusát.
          let idoStr = "ismeretlen";
          if (typeof f.ido === "string") {
            const match = f.ido.match(/T(\d{2}:\d{2})/);
            if (match) {
              idoStr = match[1];
            } else if (f.ido.includes(":")) {
              idoStr = f.ido.split(":").slice(0, 2).join(":");
            }
          } else if (typeof f.ido === "object" && f.ido !== null) {
            // Ha a driver objektumként adja vissza az időt, felhasználjuk az objektum property-jeit
            // Feltételezzük, hogy az objektum tartalmazza a 'hours' és 'minutes' mezőket.
            const hours = f.ido.hours ?? 0;
            const minutes = f.ido.minutes ?? 0;
            // Készítünk egy stringet az értékekből (pl. "14:00")
            idoStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
          
          // Oktató név: ha undefined, akkor "Ismeretlen"
          const oktatoNev = f.oktato || "Ismeretlen";
  
          // Foglalás kártya létrehozása, ami tartalmazza a "Lemondás" gombot
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `
            <p><strong>Dátum:</strong> ${datumStr}</p>
            <p><strong>Idő:</strong> ${idoStr}</p>
            <p><strong>Oktató:</strong> ${oktatoNev}</p>
            <p><strong>Megjegyzés:</strong> ${f.megjegyzes || "Nincs"}</p>
            <button class="cancel-btn" data-id="${f.esemenyId}">Lemondás</button>
          `;
          foglalasokDiv.appendChild(card);
        });
      }
    } catch (err) {
      foglalasokDiv.innerHTML = `<p class="error">${err.message}</p>`;
    }
  
    // "Lemondás" gombokra kattintás eseménykezelése
    foglalasokDiv.addEventListener("click", async (e) => {
      if (e.target && e.target.classList.contains("cancel-btn")) {
        const esemenyId = e.target.getAttribute("data-id");
        if (confirm("Biztosan le szeretnéd mondani ezt az időpontot?")) {
          try {
            const cancelRes = await fetch("/cancel", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ esemenyId })
            });
            const message = await cancelRes.text();
            if (cancelRes.ok) {
              alert("Foglalás sikeresen lemondva!");
              location.reload();
            } else {
              alert(message);
            }
          } catch (error) {
            alert("Hiba történt a lemondás során.");
          }
        }
      }
    });
  });
  