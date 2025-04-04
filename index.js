require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();
const authRoutes = require("./routes/authRoutes");

// Middleware-ek: JSON és URL-encoded adatok feldolgozása
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session kezelés
app.use(session({
    secret: 'nagyontitkoskulcs', // titkos kulcs a session-höz
    resave: false,
    saveUninitialized: false
}));

// Védelem: csak bejelentkezve lehessen elérni ezeket az oldalakat
app.get("/foglalas.html", (req, res, next) => {
    if (!req.session.email) {
        return res.redirect("/sign.html");
    }
    next();
});

app.get("/foglalasaim.html", (req, res, next) => {
    if (!req.session.email) {
        return res.redirect("/sign.html");
    }
    next();
});

// Statikus fájlok kiszolgálása (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// API útvonalak (regisztráció, bejelentkezés, foglalás)
app.use("/", authRoutes);

// Főoldal kiszolgálása
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "fooldal.html"));
});

// Szerver indítása
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Szerver fut: http://localhost:${PORT}`);
});
