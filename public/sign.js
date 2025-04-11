document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const res = await fetch("/sign", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            if (res.redirected) {
                window.location.href = res.url;
            } else {
                const text = await res.text();
                alert(text); // pl. "Hibás email vagy jelszó."
            }
        } catch (err) {
            alert("Hiba történt a bejelentkezés során.");
        }
    });
});
