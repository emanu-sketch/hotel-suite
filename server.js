const express = require("express");
const session = require("express-session");
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;
const saltRounds = 10;

/* ===================== */
/* MIDDLEWARE */
/* ===================== */
app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: "hotel_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

/* ===================== */
/* MYSQL DATABASE CONNECTION */
/* ===================== */
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',  // ← Leave empty if you have no password
    database: 'hotel_db',
    waitForConnections: true,
    connectionLimit: 10
});

// Test connection and create tables
async function initDatabase() {
    try {
        // Test connection
        const conn = await pool.getConnection();
        console.log("✅ MySQL connected successfully");
        conn.release();

        // Create tables
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                fullname VARCHAR(255),
                phone VARCHAR(50),
                department VARCHAR(100),
                role VARCHAR(50) DEFAULT 'user'
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                number VARCHAR(50) NOT NULL,
                type VARCHAR(100) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                image_url TEXT
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                user_id INT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT,
                room_id INT,
                check_in DATE NOT NULL,
                check_out DATE NOT NULL,
                total_price DECIMAL(10,2),
                status VARCHAR(20) DEFAULT 'active',
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS room_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                is_premium INT DEFAULT 0,
                base_price DECIMAL(10,2),
                capacity INT,
                bed_type VARCHAR(50),
                image_key VARCHAR(50) DEFAULT 'standard'
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                username VARCHAR(100),
                rating INT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_read BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS hotel_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE,
                setting_value TEXT
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(50),
                message TEXT,
                related_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_read BOOLEAN DEFAULT FALSE,
                target_role VARCHAR(50)
            )
        `);

        // Insert default room types
        const roomTypes = [
            ['Presidential Suite', 2, 1890, 4, 'King Bed', 'presidential'],
            ['Executive Suite', 1, 1090, 3, 'Queen Bed', 'suite'],
            ['Deluxe Room', 1, 790, 2, 'Double Bed', 'deluxe'],
            ['Premium Double', 1, 590, 2, 'Double Bed', 'standard'],
            ['Standard Double', 0, 390, 2, 'Double Bed', 'standard'],
            ['Standard Single', 0, 290, 1, 'Single Bed', 'standard']
        ];
        
        for (const [name, premium, price, capacity, bed, image] of roomTypes) {
            await pool.execute(
                `INSERT IGNORE INTO room_types (name, is_premium, base_price, capacity, bed_type, image_key) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [name, premium, price, capacity, bed, image]
            );
        }

        // Insert default hotel settings
        const settings = [
            ['hotel_lat', '28.6139'],
            ['hotel_lon', '77.2090'],
            ['hotel_city', 'New Delhi'],
            ['hotel_name', 'HotelSuite Luxury']
        ];
        
        for (const [key, value] of settings) {
            await pool.execute(
                `INSERT IGNORE INTO hotel_settings (setting_key, setting_value) VALUES (?, ?)`,
                [key, value]
            );
        }

        // Create default manager
        const [existing] = await pool.execute("SELECT * FROM users WHERE username = 'amanuel asefa'");
        if (existing.length === 0) {
            const hashedPassword = await bcrypt.hash("emanu#1259$", saltRounds);
            await pool.execute(
                "INSERT INTO users (username, password, role, fullname) VALUES (?, ?, ?, ?)",
                ["amanuel asefa", hashedPassword, "manager", "Amanuel Asefa"]
            );
            console.log("✅ Default manager created: amanuel asefa / emanu#1259$");
        }

        console.log("✅ All tables ready");
    } catch (err) {
        console.error("Database error:", err.message);
    }
}

initDatabase();

/* ===================== */
/* AUTH MIDDLEWARE */
/* ===================== */
function checkAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ message: "Not logged in" });
    }
    next();
}

function checkAdmin(req, res, next) {
    if (!req.session.user || (req.session.user.role !== "admin" && req.session.user.role !== "manager")) {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}

/* ===================== */
/* REGISTER */
/* ===================== */
app.post("/register", async (req, res) => {
    const { username, password, role, email, fullname } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
    }
    
    const userRole = role || "user";
    
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [result] = await pool.execute(
            "INSERT INTO users (username, password, role, email, fullname) VALUES (?, ?, ?, ?, ?)",
            [username, hashedPassword, userRole, email || null, fullname || username]
        );
        res.json({ success: true, id: result.insertId, role: userRole });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "Username already exists" });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

/* ===================== */
/* LOGIN */
/* ===================== */
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Missing fields" });
    }
    
    try {
        const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
        const user = rows[0];
        
        if (!user) {
            return res.status(401).json({ error: "Invalid login" });
        }
        
        const match = await bcrypt.compare(password, user.password);
        
        if (!match) {
            return res.status(401).json({ error: "Invalid login" });
        }
        
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        
        res.json({ success: true, role: user.role, username: user.username, id: user.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ===================== */
/* GET CURRENT USER */
/* ===================== */
app.get("/me", (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ message: "Not logged in" });
    }
});

/* ===================== */
/* LOGOUT */
/* ===================== */
app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

/* ===================== */
/* ROOMS */
/* ===================== */
app.get("/rooms", checkAuth, async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM rooms ORDER BY id");
    res.json(rows);
});

app.post("/rooms", checkAdmin, async (req, res) => {
    const { number, type, price } = req.body;
    const [result] = await pool.execute(
        "INSERT INTO rooms (number, type, price) VALUES (?, ?, ?)",
        [number, type, price]
    );
    res.json({ id: result.insertId });
});

app.put("/rooms/:id", checkAdmin, async (req, res) => {
    const { number, type, price } = req.body;
    await pool.execute(
        "UPDATE rooms SET number = ?, type = ?, price = ? WHERE id = ?",
        [number, type, price, req.params.id]
    );
    res.json({ success: true });
});

app.delete("/rooms/:id", checkAdmin, async (req, res) => {
    await pool.execute("DELETE FROM rooms WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

/* ===================== */
/* ROOM TYPES */
/* ===================== */
app.get("/room-types", checkAuth, async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM room_types ORDER BY is_premium DESC, name ASC");
    res.json(rows);
});

app.post("/room-types", checkAdmin, async (req, res) => {
    const { name, is_premium, image_key } = req.body;
    const [result] = await pool.execute(
        "INSERT INTO room_types (name, is_premium, image_key) VALUES (?, ?, ?)",
        [name, is_premium || 0, image_key || 'standard']
    );
    res.json({ id: result.insertId });
});

app.put("/room-types/:id", checkAdmin, async (req, res) => {
    const { image_key } = req.body;
    await pool.execute(
        "UPDATE room_types SET image_key = ? WHERE id = ?",
        [image_key, req.params.id]
    );
    res.json({ success: true });
});

app.delete("/room-types/:id", checkAdmin, async (req, res) => {
    await pool.execute("DELETE FROM room_types WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.get("/rooms/count-by-type", checkAuth, async (req, res) => {
    const [rows] = await pool.execute("SELECT COUNT(*) as count FROM rooms WHERE type = ?", [req.query.type]);
    res.json({ count: rows[0].count });
});

/* ===================== */
/* CUSTOMERS */
/* ===================== */
app.get("/customers", checkAuth, async (req, res) => {
    let query = `SELECT c.*, u.username FROM customers c LEFT JOIN users u ON c.user_id = u.id`;
    let params = [];
    
    if (req.query.user_id) {
        query += " WHERE c.user_id = ?";
        params.push(req.query.user_id);
    }
    
    const [rows] = await pool.execute(query, params);
    res.json(rows);
});

app.post("/customers", checkAuth, async (req, res) => {
    const { name, phone, user_id } = req.body;
    const customerUserId = user_id || req.session.user.id;
    
    const [result] = await pool.execute(
        "INSERT INTO customers (name, phone, user_id) VALUES (?, ?, ?)",
        [name, phone, customerUserId]
    );
    res.json({ id: result.insertId });
});

app.put("/customers/:id", checkAuth, async (req, res) => {
    const { name, phone, user_id } = req.body;
    await pool.execute(
        "UPDATE customers SET name = ?, phone = ?, user_id = ? WHERE id = ?",
        [name, phone, user_id, req.params.id]
    );
    res.json({ success: true });
});

/* ===================== */
/* BOOKINGS */
/* ===================== */
app.get("/bookings", checkAuth, async (req, res) => {
    let query = `
        SELECT b.*, c.name as customer_name, r.number as room_number, r.price as room_price
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN rooms r ON b.room_id = r.id
        WHERE b.status = 'active'
    `;
    let params = [];
    
    if (req.query.customer_id) {
        query += " AND b.customer_id = ?";
        params.push(req.query.customer_id);
    }
    
    const [rows] = await pool.execute(query, params);
    res.json(rows);
});

app.post("/bookings", checkAuth, async (req, res) => {
    const { customer_id, room_id, check_in, check_out } = req.body;
    
    const [roomRows] = await pool.execute("SELECT price FROM rooms WHERE id = ?", [room_id]);
    const room = roomRows[0];
    
    if (!room) {
        return res.status(404).json({ error: "Room not found" });
    }
    
    const days = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
    const total_price = room.price * days;
    
    const [result] = await pool.execute(
        "INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_price) VALUES (?, ?, ?, ?, ?)",
        [customer_id, room_id, check_in, check_out, total_price]
    );
    
    res.json({ id: result.insertId, total_price });
});

app.delete("/bookings/:id", checkAdmin, async (req, res) => {
    await pool.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

/* ===================== */
/* FEEDBACK */
/* ===================== */
app.post("/feedback", checkAuth, async (req, res) => {
    const { rating, comment } = req.body;
    const [result] = await pool.execute(
        "INSERT INTO feedback (user_id, username, rating, comment) VALUES (?, ?, ?, ?)",
        [req.session.user.id, req.session.user.username, rating, comment]
    );
    res.json({ success: true, id: result.insertId });
});

app.get("/feedback", checkAuth, async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM feedback ORDER BY created_at DESC");
    res.json(rows);
});

/* ===================== */
/* NOTIFICATIONS */
/* ===================== */
app.get("/notifications", checkAuth, async (req, res) => {
    const [rows] = await pool.execute(
        "SELECT * FROM notifications WHERE target_role = ? ORDER BY created_at DESC LIMIT 20",
        [req.session.user.role]
    );
    res.json(rows);
});

app.put("/notifications/:id/read", checkAuth, async (req, res) => {
    await pool.execute("UPDATE notifications SET is_read = TRUE WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

/* ===================== */
/* HOTEL SETTINGS */
/* ===================== */
app.get("/hotel-settings", checkAuth, async (req, res) => {
    const [rows] = await pool.execute("SELECT * FROM hotel_settings");
    const settings = {};
    rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
    res.json(settings);
});

app.put("/hotel-settings", checkAdmin, async (req, res) => {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
        await pool.execute(
            "UPDATE hotel_settings SET setting_value = ? WHERE setting_key = ?",
            [value, key]
        );
    }
    res.json({ success: true });
});

/* ===================== */
/* USER MANAGEMENT */
/* ===================== */
app.get("/users", checkAdmin, async (req, res) => {
    const [rows] = await pool.execute("SELECT id, username, email, fullname, role FROM users");
    res.json(rows);
});

app.put("/users/:id/role", checkAdmin, async (req, res) => {
    await pool.execute("UPDATE users SET role = ? WHERE id = ?", [req.body.role, req.params.id]);
    res.json({ success: true });
});

app.delete("/users/:id", checkAdmin, async (req, res) => {
    await pool.execute("DELETE FROM users WHERE id = ? AND username != 'amanuel asefa'", [req.params.id]);
    res.json({ success: true });
});

/* ===================== */
/* START SERVER */
/* ===================== */
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});