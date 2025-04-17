document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("admin-reg-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        try {
            const res = await fetch("/admin-reg", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, username, password })
            });

            if (res.redirected) {
                window.location.href = res.url; // Sikeres regisztráció után irány a dashboard?
            } else {
                const text = await res.text();
                alert(text); // pl. "Ez az email már regisztrálva van."
            }
        } catch (err) {
            alert("Hiba történt a regisztráció során.");
        }
    });
});
