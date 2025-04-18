const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const router = express.Router();
require("dotenv").config();

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

// ================= t.REGISZTRÁCIÓ =================
router.post("/reg", async (req, res) => {
    const { email, username, password } = req.body;
    try {
        const pool = await sql.connect(dbConfig);

        const tanuloResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT tanulokId FROM Tanulok WHERE email = @email");
        if (tanuloResult.recordset.length === 0) {
            return res.status(400).send("Ez az email cím nem tartozik egy tanulóhoz.");
        }

        const tanulokId = tanuloResult.recordset[0].tanulokId;

        const check = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM User_Name WHERE email = @email");
        if (check.recordset.length > 0) {
            return res.status(400).send("Ez az email már regisztrálva van.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

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

// ================= t.BEJELENTKEZÉS =================
router.post("/sign", async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM User_Name WHERE email = @email");
        const user = result.recordset[0];
        if (!user) return res.status(400).send("Hibás email vagy jelszó.");

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(400).send("Hibás email vagy jelszó.");

        req.session.email = email;
        res.redirect("/foglalas.html");
    } catch (err) {
        console.error("Bejelentkezési hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});


// ================= ADMIN REGISZTRÁCIÓ =================
router.post("/admin-reg", async (req, res) => {
    const { email, username, password } = req.body;

    try {
        const pool = await sql.connect(dbConfig);

        // Ellenőrizzük, hogy az oktatók között szerepel-e az email
        const oktatoResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (oktatoResult.recordset.length === 0) {
            return res.status(400).send("Ez az email cím nem tartozik egy oktatóhoz.");
        }

        const adminId = oktatoResult.recordset[0].oktatokId;

        // Ellenőrizzük, hogy már regisztrált-e adminként
        const check = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM Admin WHERE email = @email");

        if (check.recordset.length > 0) {
            return res.status(400).send("Ez az oktató már regisztrált.");
        }

        // Jelszó hash
        const hashedPassword = await bcrypt.hash(password, 10);

        // Admin beszúrás
        await pool.request()
            .input("adminId", sql.Int, adminId)
            .input("username", sql.NVarChar, username)
            .input("email", sql.NVarChar, email)
            .input("password_hash", sql.NVarChar, hashedPassword)
            .query(`
                INSERT INTO Admin (adminId, username, email, password_hash)
                VALUES (@adminId, @username, @email, @password_hash)
            `);

        // Bejelentkeztetjük az admin felhasználót
        req.session.adminEmail = email;

        // Átirányítás az admin felületre
        res.redirect("/adminOldal.html");
    } catch (err) {
        console.error("Admin regisztrációs hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});


// ================= ADMIN BEJELENTKEZÉS =================
router.post("/admin-sign", async (req, res) => {
    const { email, password } = req.body;

    try {
        const pool = await sql.connect(dbConfig);

        // Megkeressük az admint az email alapján
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT * FROM Admin WHERE email = @email");

        const admin = result.recordset[0];

        if (!admin) {
            return res.status(400).send("Hibás email vagy jelszó.");
        }

        // Jelszó ellenőrzése
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            return res.status(400).send("Hibás email vagy jelszó.");
        }

        // Session beállítása
        req.session.adminEmail = email;

        // Átirányítás az admin felületre
        res.redirect("/adminOldal.html");
    } catch (err) {
        console.error("Admin bejelentkezési hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

// ========== ADMIN FOGLALÁSOK LEKÉRÉSE ==========
router.get("/admin-foglalasok", async (req, res) => {
    const email = req.session.adminEmail;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve adminként.");

    try {
        const pool = await sql.connect(dbConfig);

        // Lekérjük az oktatokId-t az email alapján
        const oktatoResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (oktatoResult.recordset.length === 0) {
            return res.status(400).send("Oktató nem található.");
        }

        const oktatokId = oktatoResult.recordset[0].oktatokId;

        // Összes hozzá tartozó foglalás lekérdezése
        const result = await pool.request()
            .input("oktatokId", sql.Int, oktatokId)
            .query(`
                SELECT esemenyId, datum, ido, email, megjegyzes
                FROM esemeny
                WHERE oktatokId = @oktatokId
                ORDER BY datum ASC, ido ASC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Admin foglalások lekérési hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

// ========== ADMIN IDŐPONT TÖRLÉS ==========
router.post("/admin-delete", async (req, res) => {
    const email = req.session.adminEmail;
    const { esemenyId } = req.body;

    if (!email) return res.status(403).send("Nem vagy bejelentkezve adminként.");

    try {
        const pool = await sql.connect(dbConfig);

        // Lekérjük az eseményt
        const result = await pool.request()
            .input("esemenyId", sql.Int, parseInt(esemenyId))
            .query("SELECT datum, ido FROM esemeny WHERE esemenyId = @esemenyId");

        const esemeny = result.recordset[0];
        if (!esemeny) return res.status(400).send("Esemény nem található.");

        const datum = new Date(esemeny.datum);
        const ido = esemeny.ido;

        // Idő szétbontása (óra + perc)
        let ora = 0;
        let perc = 0;

        if (ido instanceof Date) {
            ora = ido.getHours();
            perc = ido.getMinutes();
        } else if (typeof ido === "string") {
            const parts = ido.split(":");
            ora = parseInt(parts[0]);
            perc = parseInt(parts[1]);
        } else {
            throw new Error("Ismeretlen időformátum az 'ido' mezőnél.");
        }

        // Pontos esemény időpont összeállítása
        const esemenyIdopont = new Date(
            datum.getFullYear(),
            datum.getMonth(),
            datum.getDate(),
            ora,
            perc
        );

        const most = new Date();

        // Csak jövőbeli időpontot engedünk törölni
        if (esemenyIdopont <= most) {
            return res.status(403).send("Csak jövőbeli időpontot lehet törölni.");
        }

        // Törlés végrehajtása
        await pool.request()
            .input("esemenyId", sql.Int, parseInt(esemenyId))
            .query("DELETE FROM esemeny WHERE esemenyId = @esemenyId");

        res.send("Időpont sikeresen törölve.");
    } catch (err) {
        console.error("Admin törlés hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});










// ================= KIJELENTKEZÉS =================
router.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) console.error("Session törlés hiba:", err);
        res.redirect("/fooldal.html");
    });
});

// ============== T.FOGLALÁS ==============
router.post("/foglalas", async (req, res) => {
    const email = req.session.email;
    const { oktatokId, datum, ido, megjegyzes } = req.body;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve.");

    try {
        const pool = await sql.connect(dbConfig);
        const userResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT id FROM User_Name WHERE email = @email");
        
        if (userResult.recordset.length === 0)
            return res.status(400).send("Hiba: regisztrált felhasználó nem található.");

        const tanulokId = userResult.recordset[0].id;

        await pool.request()
            .input("tanulokId", sql.Int, tanulokId)
            .input("oktatokId", sql.TinyInt, parseInt(oktatokId))
            .input("datum", sql.Date, datum)
            .input("ido", sql.NVarChar, ido)
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

// ==============t. LEMONDÁS ==============
router.post("/cancel", async (req, res) => {
    const { esemenyId } = req.body;
    const email = req.session.email;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve.");

    try {
        const pool = await sql.connect(dbConfig);
        const reservationResult = await pool.request()
            .input("esemenyId", sql.Int, parseInt(esemenyId))
            .input("email", sql.NVarChar, email)
            .query("SELECT datum FROM esemeny WHERE esemenyId = @esemenyId AND email = @email");

        if (reservationResult.recordset.length === 0)
            return res.status(400).send("Foglalás nem található.");

        const reservation = reservationResult.recordset[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const appDate = new Date(reservation.datum);
        appDate.setHours(0, 0, 0, 0);
        const diffDays = (appDate - today) / (1000 * 60 * 60 * 24);

        if (diffDays < 2)
            return res.status(400).send("Az időpontot megelőző nap már nem tudsz lemondani.");

        await pool.request()
            .input("esemenyId", sql.Int, parseInt(esemenyId))
            .query("DELETE FROM esemeny WHERE esemenyId = @esemenyId");

        res.send("Foglalás sikeresen lemondva.");
    } catch (err) {
        console.error("Lemondási hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

// ============== t. FOGLALÁSAIM ==============
router.get("/foglalasaim", async (req, res) => {
    const email = req.session.email;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve.");

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query(`
                SELECT 
                    e.esemenyId,
                    e.oktatokId,
                    e.datum,
                    e.ido,
                    e.megjegyzes,
                    o.nev AS oktato
                FROM esemeny e
                LEFT JOIN oktatok o ON e.oktatokId = o.oktatokId
                WHERE e.email = @email
                ORDER BY e.datum DESC, e.ido DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Foglalás lekérés hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});


// ================= t. PROFILADATOK =================
router.get("/profiladatok", async (req, res) => {
    const email = req.session.email;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve.");

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

// =================naptar Foglalt időpontok oktató + dátum alapján =================
router.get("/foglalt-idopontok", async (req, res) => {
    const { oktatokId, datum } = req.query;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("oktatokId", sql.TinyInt, parseInt(oktatokId))
            .input("datum", sql.Date, datum)
            .query("SELECT ido FROM esemeny WHERE oktatokId = @oktatokId AND datum = @datum");

        const foglaltak = result.recordset.map(r => r.ido);
        res.json(foglaltak);
    } catch (err) {
        console.error("Foglalt időpontok lekérési hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

// ================= Összes foglalás naptárhoz =================
router.get("/osszes-foglalas", async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                e.datum,
                e.ido,
                e.email,
                e.oktatokId,
                o.nev AS oktato
            FROM esemeny e
            LEFT JOIN oktatok o ON e.oktatokId = o.oktatokId
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Foglalások lekérési hiba (naptárhoz):", err);
        res.status(500).send("Szerverhiba.");
    }
});

module.exports = router;


