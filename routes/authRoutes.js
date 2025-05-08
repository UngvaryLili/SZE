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
    const { email, username, password, szuloEmail } = req.body;

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
            .input("szuloEmail", sql.NVarChar, szuloEmail || null)
            .query(`
                INSERT INTO User_Name (id, email, username, password_hash, szuloEmail)
                VALUES (@id, @email, @username, @password_hash, @szuloEmail)
            `);

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


// ========== ADMIN ÚJ ELÉRHETŐ IDŐPONT HOZZÁADÁSA ==========
router.post("/admin-elerheto-idopont", async (req, res) => {
    const email = req.session.adminEmail;
    const { datum, ido, megjegyzes } = req.body;

    if (!email) return res.status(403).send("Nem vagy bejelentkezve adminként.");
    if (!datum || !ido) return res.status(400).send("A dátum és az időpont megadása kötelező.");

    // ====== DÁTUMELLENŐRZÉS ======
    const selectedDate = new Date(datum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDatum = new Date("2025-06-27");

    if (selectedDate <= today) {
        return res.status(400).send("Mai vagy múltbeli napra nem lehet időpontot beállítani.");
    }

    if (selectedDate > maxDatum) {
        return res.status(400).send("2025.06.27. utánra nem lehet időpontot beállítani.");
    }

    if (selectedDate.getDay() === 0) {
        return res.status(400).send("Vasárnapra nem lehet időpontot beállítani.");
    }

    try {
        const pool = await sql.connect(dbConfig);

        // Oktató ID lekérdezése e-mail alapján
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (result.recordset.length === 0) {
            return res.status(400).send("Oktató nem található.");
        }

        const oktatokId = result.recordset[0].oktatokId;

        // ====== IDŐ KONVERTÁLÁSA stringgé: "09:00:00" formátumban ======
        const [ora, perc] = ido.split(":").map(Number);
        const idoStr = `${ora.toString().padStart(2, "0")}:${perc.toString().padStart(2, "0")}:00`;

        // ====== BESZÚRÁS ======
        await pool.request()
            .input("oktatokId", sql.TinyInt, oktatokId)
            .input("datum", sql.Date, datum)
            .input("ido", sql.VarChar, idoStr) // szövegként küldjük időzóna nélkül
            .input("megjegyzes", sql.NVarChar, megjegyzes || "")
            .query(`
                INSERT INTO ElérhetőIdopontok (oktatokId, datum, ido, megjegyzes)
                VALUES (@oktatokId, @datum, @ido, @megjegyzes)
            `);

        res.send("Elérhető időpont sikeresen hozzáadva.");
    } catch (err) {
        console.error("Elérhető időpont hozzáadási hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

// ========== DUPLIKÁLT IDŐPONT ELLENŐRZÉS ==========
router.get("/admin-ellenorzes", async (req, res) => {
    const email = req.session.adminEmail;
    const { datum, ido } = req.query;

    if (!email) return res.status(403).json({ marVan: false });

    try {
        const pool = await sql.connect(dbConfig);

        const oktatoRes = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (oktatoRes.recordset.length === 0)
            return res.status(400).json({ marVan: false });

        const oktatokId = oktatoRes.recordset[0].oktatokId;

        const [ora, perc] = ido.split(":").map(Number);
        const idoStr = `${ora.toString().padStart(2, "0")}:${perc.toString().padStart(2, "0")}:00`;

        const result = await pool.request()
            .input("oktatokId", sql.TinyInt, oktatokId)
            .input("datum", sql.Date, datum)
            .input("ido", sql.VarChar, idoStr)
            .query("SELECT * FROM ElérhetőIdopontok WHERE oktatokId = @oktatokId AND datum = @datum AND ido = @ido");

        if (result.recordset.length > 0) {
            return res.json({ marVan: true });
        } else {
            return res.json({ marVan: false });
        }
    } catch (err) {
        console.error("Időpont ellenőrzési hiba:", err);
        res.status(500).json({ marVan: false });
    }
});


//naptár admin oldal

// ======== ADMIN NAPTÁR: Saját kiírt időpontok lekérdezése ========
// ========== ADMIN KIÍRT IDŐPONTOK – NAPTÁR MEGJELENÍTÉS ==========

router.get("/admin-kiratasaim", async (req, res) => {
    const email = req.session.adminEmail;
    if (!email) return res.status(403).json([]);

    try {
        const pool = await sql.connect(dbConfig);
        const oktatoRes = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (oktatoRes.recordset.length === 0) {
            return res.status(400).json([]);
        }

        const oktatokId = oktatoRes.recordset[0].oktatokId;

        const result = await pool.request()
            .input("oktatokId", sql.TinyInt, oktatokId)
            .query(`
                SELECT 
                    ki.datum, 
                    CAST(ki.ido AS varchar) AS ido, 
                    ki.megjegyzes,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM esemeny e
                            WHERE e.oktatokId = ki.oktatokId 
                              AND e.datum = ki.datum 
                              AND e.ido = ki.ido
                        ) 
                        THEN 1 ELSE 0 
                    END AS foglalt
                FROM ElérhetőIdopontok ki
                WHERE ki.oktatokId = @oktatokId
            `);

        const events = result.recordset.map(row => {
            const datum = row.datum.toISOString().split("T")[0];
            const [ora, perc] = row.ido.split(":");

            const start = `${datum}T${ora}:${perc}:00`;
            const endOra = String(parseInt(ora) + 1).padStart(2, "0");
            const end = `${datum}T${endOra}:${perc}:00`;

            return {
                title: row.megjegyzes || "Elérhető",
                start,
                end,
                color: row.foglalt ? "#ffc107" : "#28a745", // narancs: foglalt, zöld: szabad
                extendedProps: {
                    foglalt: row.foglalt === 1,
                    datum,
                    ido: `${ora}:${perc}`
                }
            };
        });

        res.json(events);
    } catch (err) {
        console.error("Kiírt időpontok lekérése (admin):", err);
        res.status(500).json([]);
    }
});



router.get("/admin-ellenorzes-foglalas", async (req, res) => {
    const email = req.session.adminEmail;
    const { datum, ido } = req.query;
    if (!email) return res.status(403).json({ vanFoglalas: false });

    try {
        const pool = await sql.connect(dbConfig);

        const oktatoRes = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (oktatoRes.recordset.length === 0)
            return res.status(400).json({ vanFoglalas: false });

        const oktatokId = oktatoRes.recordset[0].oktatokId;

        const result = await pool.request()
            .input("oktatokId", sql.Int, oktatokId)
            .input("datum", sql.Date, datum)
            .input("ido", sql.VarChar, ido + ":00") // "15:00" -> "15:00:00"
            .query("SELECT COUNT(*) AS count FROM esemeny WHERE oktatokId = @oktatokId AND datum = @datum AND ido = @ido");

        const vanFoglalas = result.recordset[0].count > 0;
        res.json({ vanFoglalas });
    } catch (err) {
        console.error("Foglalás ellenőrzés hiba:", err);
        res.status(500).json({ vanFoglalas: false });
    }
});


router.post("/admin-idopont-torles", async (req, res) => {
    const email = req.session.adminEmail;
    const { datum, ido } = req.body;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve.");

    try {
        const pool = await sql.connect(dbConfig);

        const oktatoRes = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT oktatokId FROM oktatok WHERE email = @email");

        if (oktatoRes.recordset.length === 0)
            return res.status(400).send("Oktató nem található.");

        const oktatokId = oktatoRes.recordset[0].oktatokId;

        await pool.request()
            .input("oktatokId", sql.Int, oktatokId)
            .input("datum", sql.Date, datum)
            .input("ido", sql.VarChar, ido + ":00")
            .query("DELETE FROM ElérhetőIdopontok WHERE oktatokId = @oktatokId AND datum = @datum AND ido = @ido");

        res.send("Időpont törölve.");
    } catch (err) {
        console.error("Időpont törlés hiba:", err);
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
const nodemailer = require("nodemailer"); // csak egyszer kell a fájl tetején

router.post("/foglalas", async (req, res) => {
    const email = req.session.email;
    const { oktatokId, datum, ido, megjegyzes } = req.body;
    if (!email) return res.status(403).send("Nem vagy bejelentkezve.");

    try {
        const pool = await sql.connect(dbConfig);

        // Felhasználó azonosítása
        const userResult = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT id, szuloEmail FROM User_Name WHERE email = @email");

        if (userResult.recordset.length === 0)
            return res.status(400).send("Hiba: regisztrált felhasználó nem található.");

        const tanulokId = userResult.recordset[0].id;
        const szuloEmail = userResult.recordset[0].szuloEmail;

        const szamlaEmail = szuloEmail || email; 

        // Foglalás mentése
        await pool.request()
            .input("tanulokId", sql.Int, tanulokId)
            .input("oktatokId", sql.TinyInt, parseInt(oktatokId))
            .input("datum", sql.Date, datum)
            .input("ido", sql.NVarChar, ido)
            .input("megjegyzes", sql.NVarChar, megjegyzes || "")
            .input("email", sql.NVarChar, email)
            .input("szamlaEmail", sql.NVarChar, szamlaEmail)
            .query(`
                INSERT INTO esemeny (tanulokId, oktatokId, datum, ido, megjegyzes, email, Számlafizető_email)
                VALUES (@tanulokId, @oktatokId, @datum, @ido, @megjegyzes, @email, @szamlaEmail)
            `);

        // Szülő értesítése (ha van megadva)
        if (szuloEmail) {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                  user: process.env.EMAIL_USER,
                  pass: process.env.EMAIL_PASS
                },
                tls: {
                  rejectUnauthorized: false
                }
              });
              

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: szuloEmail,
                subject: "Új magánóra foglalás",
                text: `Kedves Szülő!\n\nGyermeke (${email}) új magánórát foglalt:\n\nDátum: ${datum}\nIdőpont: ${ido}\nOktató azonosító: ${oktatokId}\n\nÜdvözlettel:\nMagántanár rendszer`
            };

            await transporter.sendMail(mailOptions);
        }

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

        // Lekérjük az eseményt a törléshez és e-mail küldéshez
        const reservationResult = await pool.request()
            .input("esemenyId", sql.Int, parseInt(esemenyId))
            .input("email", sql.NVarChar, email)
            .query("SELECT datum, ido FROM esemeny WHERE esemenyId = @esemenyId AND email = @email");

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

        // Előbb törlés
        await pool.request()
            .input("esemenyId", sql.Int, parseInt(esemenyId))
            .query("DELETE FROM esemeny WHERE esemenyId = @esemenyId");

        res.send("Foglalás sikeresen lemondva.");

        // Külön blokkban: szülő értesítése
        // Külön blokkban: szülő értesítése
        try {
            const szuloResult = await pool.request()
                .input("email", sql.NVarChar, email)
                .query("SELECT szuloEmail FROM User_Name WHERE email = @email");

            const szuloEmail = szuloResult.recordset[0]?.szuloEmail;

            if (szuloEmail) {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                });

                let idoFormazva = "Ismeretlen időpont";

                
                if (reservation.ido instanceof Date) {
                    const ora = reservation.ido.getUTCHours().toString().padStart(2, "0");
                    const perc = reservation.ido.getUTCMinutes().toString().padStart(2, "0");
                    idoFormazva = `${ora}:${perc}`;
                }


                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: szuloEmail,
                    subject: "Lemondott magánóra",
                    text: `Kedves Szülő!\n\nGyermeke (${email}) lemondta az alábbi magánórát:\nDátum: ${reservation.datum.toISOString().split("T")[0]}\nIdőpont: ${idoFormazva}\n\nÜdvözlettel:\nMagántanár rendszer`



                };
                

                await transporter.sendMail(mailOptions);
            }
        } catch (emailErr) {
            console.error("Szülői e-mail küldési hiba (lemondásnál):", emailErr);
        }


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



// ========== !!!ELÉRHETŐ IDŐPONTOK LEKÉRÉSE (tanulói foglaláshoz) ==========
// ========== !!!ELÉRHETŐ IDŐPONTOK LEKÉRÉSE (tanulói foglaláshoz) ==========
router.get("/elerheto-idopontok", async (req, res) => {
    const { oktatokId, datum } = req.query;

    if (!oktatokId || !datum) {
        return res.status(400).send("Hiányzó paraméterek.");
    }

    try {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input("oktatokId", sql.TinyInt, parseInt(oktatokId))
            .input("datum", sql.Date, datum)
            .query(`
                SELECT CAST(ido AS varchar) AS ido 
                FROM ElérhetőIdopontok 
                WHERE oktatokId = @oktatokId AND datum = @datum
                ORDER BY ido ASC
            `);

        const idopontok = result.recordset.map(r => {
            return r.ido.split(":").slice(0, 2).join(":");
        });

        res.json(idopontok);
    } catch (err) {
        console.error("Elérhető időpontok lekérése hiba:", err);
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


// ================= Tanulok összes foglalas =================
router.get("/osszes-elerheto-idopont", async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request().query(`
            SELECT 
                e.datum,
                CAST(e.ido AS varchar) AS ido,
                o.nev AS oktato,
                e.oktatokId
            FROM ElérhetőIdopontok e
            LEFT JOIN oktatok o ON e.oktatokId = o.oktatokId
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Elérhető időpontok lekérése (összes) hiba:", err);
        res.status(500).send("Szerverhiba.");
    }
});

