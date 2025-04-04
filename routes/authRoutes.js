const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const router = express.Router();
require("dotenv").config();

//  Adatbázis konfiguráció .env alapján
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

//  REGISZTRÁCIÓ
router.post("/reg", async (req, res) => {
    const { email, username, password } = req.body;

    try {
        const pool = await sql.connect(dbConfig);

        const check = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM User_Name WHERE email = @email");

        if (check.recordset.length > 0) {
            return res.status(400).send("Ez az email már regisztrálva van.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input("email", sql.NVarChar, email)
            .input("username", sql.NVarChar, username)
            .input("password_hash", sql.NVarChar, hashedPassword)
            .query("INSERT INTO User_Name (email, username, password_hash) VALUES (@email, @username, @password_hash)");

        req.session.email = email;
        res.redirect("/foglalas.html");
    } catch (err) {
        console.error("Regisztrációs hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//  BEJELENTKEZÉS
router.post("/sign", async (req, res) => {
    const { email, password } = req.body;

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM User_Name WHERE email = @email");

        const user = result.recordset[0];

        if (!user) {
            return res.status(400).send("Hibás email vagy jelszó.");
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(400).send("Hibás email vagy jelszó.");
        }

        req.session.email = email;
        res.redirect("/foglalas.html");
    } catch (err) {
        console.error("Bejelentkezési hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//  KIJELENTKEZÉS
router.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Session törlés hiba:", err);
        }
        res.redirect("/fooldal.html");
    });
});

//  FOGLALÁS MENTÉSE – időzóna fix
router.post("/foglalas", async (req, res) => {
    const email = req.session.email;
    const { oktato, datum, ido, megjegyzes } = req.body;

    if (!email) {
        return res.status(403).send("Nem vagy bejelentkezve.");
    }

    try {
        //  Időpont stringből UTC Date objektum (időzóna-eltolódás nélkül)
        const [ora, perc] = ido.split(":").map(Number);
        const idoObj = new Date(Date.UTC(1970, 0, 1, ora, perc));

        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input("email", sql.NVarChar, email)
            .input("oktato", sql.NVarChar, oktato)
            .input("datum", sql.Date, datum)
            .input("ido", sql.Time, idoObj) //  időzónára figyelj
            .input("megjegyzes", sql.NVarChar, megjegyzes || "")
            .query("INSERT INTO Appointments (email, oktato, datum, ido, megjegyzes) VALUES (@email, @oktato, @datum, @ido, @megjegyzes)");

        res.redirect("/foglalasaim.html");
    } catch (err) {
        console.error("Foglalási hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//  FOGLALÁSOK LISTÁZÁSA
router.get("/foglalasaim", async (req, res) => {
    const email = req.session.email;

    if (!email) {
        return res.status(403).send("Nem vagy bejelentkezve.");
    }

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktato, datum, ido, megjegyzes FROM Appointments WHERE email = @email ORDER BY datum DESC, ido DESC");

        res.json(result.recordset);
    } catch (err) {
        console.error("Foglalás lekérés hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//  PROFILADATOK LEKÉRÉSE
router.get("/profiladatok", async (req, res) => {
    const email = req.session.email;

    if (!email) {
        return res.status(403).send("Nem vagy bejelentkezve.");
    }

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT username FROM User_Name WHERE email = @email");

        const username = result.recordset[0]?.username || "Ismeretlen";

        res.json({ email, username });
    } catch (err) {
        console.error("Profil lekérés hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

module.exports = router;
