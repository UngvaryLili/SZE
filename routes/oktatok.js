const express = require("express");
const sql = require("mssql");
const router = express.Router();
require("dotenv").config();

// Adatbázis konfiguráció (megegyezik a többi route-nál használtal)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
};

// GET /oktatok – lekérdezi az összes oktatót az "oktatok" táblából
router.get("/", async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        // Tegyük fel, hogy az "oktatok" tábla oszlopai: oktatoId, nev
        const result = await pool.request().query("SELECT oktatokId, nev FROM oktatok ORDER BY nev");
        res.json(result.recordset); // JSON formátumban visszaküldi az eredményt
    } catch (err) {
        console.error("Oktatók lekérdezési hiba:", err);
        res.status(500).send("Szerverhiba");
    }
});

module.exports = router;
