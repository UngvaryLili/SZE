const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const router = express.Router();
require("dotenv").config();

// Adatbázis konfiguráció .env alapján
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE, // Győződj meg róla, hogy itt a megfelelő adatbázis szerepel
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

//
// REGISZTRÁCIÓ – Csak azok regisztrálhatnak, akiknek az email címe szerepel a Tanulok táblában.
// A Tanulok táblából lekérjük a tanulokId értéket, majd ezt kézzel állítjuk be a User_Name tábla id mezőjében.
// (Fontos: Az új User_Name tábla id oszlopa nem auto‑increment, és a Tanulok.tanulokId-vel kell egyeznie.)
//
router.post("/reg", async (req, res) => {
    const { email, username, password } = req.body;
    try {
        const pool = await sql.connect(dbConfig);

        // Ellenőrizzük, hogy az email szerepel-e a Tanulok táblában
        const tanuloResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT tanulokId FROM Tanulok WHERE email = @email");
        if (tanuloResult.recordset.length === 0) {
            return res.status(400).send("Ez az email cím nem tartozik egy tanulóhoz.");
        }
        // Lekérjük a diákhoz tartozó tanulokId értékét
        const tanulokId = tanuloResult.recordset[0].tanulokId;

        // Ellenőrizzük, hogy az email még nincs-e regisztrálva a User_Name táblában
        const check = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM User_Name WHERE email = @email");
        if (check.recordset.length > 0) {
            return res.status(400).send("Ez az email már regisztrálva van.");
        }

        // Jelszó hash-elése
        const hashedPassword = await bcrypt.hash(password, 10);

        // Beszúrjuk az új felhasználói rekordot a User_Name táblába,
        // úgy, hogy az "id" mezőbe a Tanulok.tanulokId értékét adjuk meg.
        await pool.request()
            .input("id", sql.Int, tanulokId)
            .input("email", sql.NVarChar, email)
            .input("username", sql.NVarChar, username)
            .input("password_hash", sql.NVarChar, hashedPassword)
            .query("INSERT INTO User_Name (id, email, username, password_hash) VALUES (@id, @email, @username, @password_hash)");

        req.session.email = email;
        res.redirect("/foglalas.html");
    } catch (err) {
        console.error("Regisztrációs hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//
// BEJELENTKEZÉS – Az email alapján keresünk a User_Name táblában.
//
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

//
// KIJELENTKEZÉS
//
router.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Session törlés hiba:", err);
        }
        res.redirect("/fooldal.html");
    });
});

//
// FOGLALÁS MENTÉSE – Az adatokat az "esemeny" táblába mentjük.
// Ebben a verzióban először lekérjük a felhasználó tanulokId-jét az User_Name táblából,
// majd azt illesztjük be az esemeny rekordba, így elkerülve, hogy az esemenyId vagy tanulokId értéke NULL legyen.
// (Az esemenyId automatikusan generálódik, ha be van állítva IDENTITY tulajdonságként)
router.post("/foglalas", async (req, res) => {
    const email = req.session.email;
    const { oktatokId, datum, ido, megjegyzes } = req.body;
    if (!email) {
        return res.status(403).send("Nem vagy bejelentkezve.");
    }
    try {
        const pool = await sql.connect(dbConfig);
        // Lekérjük a felhasználó tanulokId-jét a User_Name táblából
        const userResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT id FROM User_Name WHERE email = @email");
        if (userResult.recordset.length === 0) {
            return res.status(400).send("Hiba: regisztrált felhasználó nem található.");
        }
        const tanulokId = userResult.recordset[0].id;

        await pool.request()
            .input("tanulokId", sql.Int, tanulokId)
            .input("oktatokId", sql.TinyInt, parseInt(oktatokId))
            .input("datum", sql.Date, datum)
            .input("ido", sql.NVarChar, ido) // Például "14:00"
            .input("megjegyzes", sql.NVarChar, megjegyzes || "")
            .input("email", sql.NVarChar, email)
            .query(`
                INSERT INTO esemeny (tanulokId, oktatokId, datum, ido, megjegyzes, email)
                VALUES (@tanulokId, @oktatokId, @datum, @ido, @megjegyzes, @email)
            `);
        res.redirect("/foglalasaim.html");
    } catch (err) {
        console.error("Foglalási hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//
// FOGLALÁSOK LEKÉRÉSE – Az "esemeny" táblából,
// módosítva úgy, hogy a JOIN segítségével az oktatok táblából kinyerjük az oktató nevét.
router.get("/foglalasaim", async (req, res) => {
    const email = req.session.email;
    if (!email) {
        return res.status(403).send("Nem vagy bejelentkezve.");
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query(`
                SELECT 
                    e.oktatokId,
                    e.datum,
                    e.ido,
                    e.megjegyzes,
                    o.nev AS oktato
                FROM esemeny e
                LEFT JOIN oktatok o
                    ON e.oktatokId = o.oktatokId
                WHERE e.email = @email
                ORDER BY e.datum DESC, e.ido DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Foglalás lekérés hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

//
// PROFIL ADATOK LEKÉRÉSE
//
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
