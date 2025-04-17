require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();
const authRoutes = require("./routes/authRoutes");
const oktatokRoutes = require("./routes/oktatok"); // Új útvonal importálása

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session kezelés
app.use(session({
    secret: 'nagyontitkoskulcs', // titkos kulcs a session-höz
    resave: false,    //akkor csak akkor kerül mentésre a session, ha ténylegesen módosítás történt
    saveUninitialized: false  //ha valóban tartalmaz adatokat
}));

// csak bejelentkezve lehessen elérni ezeket az oldalakat
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

// Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname, "public")));

// Auth útvonalak
app.use("/", authRoutes);

// Oktatókat lekérdező útvonal; így elérhető a http://localhost:5000/oktatok
app.use("/oktatok", oktatokRoutes);

// Kezdőoldal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "fooldal.html"));
});

// Szerver indítása
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Szerver fut: http://localhost:${PORT}`);
});
