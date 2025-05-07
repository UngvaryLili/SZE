document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("reg-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const szuloEmail = document.getElementById("szuloEmail").value; // új sor

        try {
            const res = await fetch("/reg", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, username, password, szuloEmail }) // új mező hozzáadva
            });

            if (res.redirected) {
                window.location.href = res.url; // Sikeres regisztráció → foglalas.html
            } else {
                const text = await res.text();
                alert(text); // pl. "Ez az email már regisztrálva van."
            }
        } catch (err) {
            alert("Hiba történt a regisztráció során.");
        }
    });
});
