const express = require("express");
const session = require("express-session");
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// Middleware
app.use(express.json());
app.use(express.static(__dirname + "/public"));

app.use(session({
    secret: "hotel_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// SQLite Database
const db = new sqlite3.Database('./hotel.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT,
        fullname TEXT,
        phone TEXT,
        role TEXT DEFAULT 'user'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT,
        type TEXT,
        price REAL,
        image_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        user_id INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        room_id INTEGER,
        check_in TEXT,
        check_out TEXT,
        total_price REAL,
        status TEXT DEFAULT 'active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS room_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        is_premium INTEGER DEFAULT 0,
        image_key TEXT DEFAULT 'standard'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        rating INTEGER,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS hotel_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE,
        setting_value TEXT
    )`);

    // Insert default room types
    const defaultTypes = ['Presidential Suite', 'Executive Suite', 'Deluxe Room', 'Standard Double'];
    defaultTypes.forEach((type, i) => {
        db.run(`INSERT OR IGNORE INTO room_types (name, is_premium) VALUES (?, ?)`, [type, i < 2 ? 1 : 0]);
    });

    // Insert default settings
    db.run(`INSERT OR IGNORE INTO hotel_settings (setting_key, setting_value) VALUES 
        ('hotel_name', 'HotelSuite Luxury'),
        ('hotel_city', 'New Delhi')`);

    // Create default manager
    db.get("SELECT * FROM users WHERE username = 'amanuel asefa'", async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash("emanu#1259$", saltRounds);
            db.run("INSERT INTO users (username, password, role, fullname) VALUES (?, ?, ?, ?)",
                ["amanuel asefa", hashedPassword, "manager", "Amanuel Asefa"]);
            console.log("✅ Default manager created");
        }
    });
});

// ==================== AUTH ROUTES ====================
function checkAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    next();
}

function checkAdmin(req, res, next) {
    if (!req.session.user || (req.session.user.role !== "admin" && req.session.user.role !== "manager")) {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}

app.post("/register", async (req, res) => {
    const { username, password, role, email, fullname } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        db.run("INSERT INTO users (username, password, role, email, fullname) VALUES (?, ?, ?, ?, ?)",
            [username, hashedPassword, role || 'user', email || null, fullname || username],
            function(err) {
                if (err) return res.status(400).json({ error: "Username exists" });
                res.json({ success: true, id: this.lastID });
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Invalid login" });
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid login" });
        
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.json({ success: true, role: user.role });
    });
});

app.get("/me", (req, res) => {
    if (req.session.user) res.json(req.session.user);
    else res.status(401).json({ message: "Not logged in" });
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// ==================== ROOMS ====================
app.get("/rooms", checkAuth, (req, res) => {
    db.all("SELECT * FROM rooms", [], (err, rows) => res.json(rows || []));
});

app.post("/rooms", checkAdmin, (req, res) => {
    const { number, type, price } = req.body;
    db.run("INSERT INTO rooms (number, type, price) VALUES (?, ?, ?)", [number, type, price], function(err) {
        res.json({ id: this.lastID });
    });
});

app.put("/rooms/:id", checkAdmin, (req, res) => {
    const { number, type, price } = req.body;
    db.run("UPDATE rooms SET number=?, type=?, price=? WHERE id=?", [number, type, price, req.params.id]);
    res.json({ success: true });
});

app.delete("/rooms/:id", checkAdmin, (req, res) => {
    db.run("DELETE FROM rooms WHERE id=?", [req.params.id]);
    res.json({ success: true });
});

// ==================== ROOM TYPES ====================
app.get("/room-types", checkAuth, (req, res) => {
    db.all("SELECT * FROM room_types", [], (err, rows) => res.json(rows || []));
});

app.post("/room-types", checkAdmin, (req, res) => {
    const { name, is_premium, image_key } = req.body;
    db.run("INSERT INTO room_types (name, is_premium, image_key) VALUES (?, ?, ?)", 
        [name, is_premium || 0, image_key || 'standard'], function(err) {
        res.json({ id: this.lastID });
    });
});

app.put("/room-types/:id", checkAdmin, (req, res) => {
    const { image_key } = req.body;
    db.run("UPDATE room_types SET image_key=? WHERE id=?", [image_key, req.params.id]);
    res.json({ success: true });
});

app.delete("/room-types/:id", checkAdmin, (req, res) => {
    db.run("DELETE FROM room_types WHERE id=?", [req.params.id]);
    res.json({ success: true });
});

// ==================== CUSTOMERS ====================
app.get("/customers", checkAuth, (req, res) => {
    let query = "SELECT c.*, u.username FROM customers c LEFT JOIN users u ON c.user_id = u.id";
    let params = [];
    if (req.query.user_id) {
        query += " WHERE c.user_id = ?";
        params.push(req.query.user_id);
    }
    db.all(query, params, (err, rows) => res.json(rows || []));
});

app.post("/customers", checkAuth, (req, res) => {
    const { name, phone, user_id } = req.body;
    const customerUserId = user_id || req.session.user.id;
    db.run("INSERT INTO customers (name, phone, user_id) VALUES (?, ?, ?)", 
        [name, phone, customerUserId], function(err) {
        res.json({ id: this.lastID });
    });
});

app.put("/customers/:id", checkAuth, (req, res) => {
    const { name, phone, user_id } = req.body;
    db.run("UPDATE customers SET name=?, phone=?, user_id=? WHERE id=?", 
        [name, phone, user_id, req.params.id]);
    res.json({ success: true });
});

// ==================== BOOKINGS ====================
app.get("/bookings", checkAuth, (req, res) => {
    let query = `SELECT b.*, c.name as customer_name, r.number as room_number 
                 FROM bookings b JOIN customers c ON b.customer_id = c.id 
                 JOIN rooms r ON b.room_id = r.id WHERE b.status = 'active'`;
    let params = [];
    if (req.query.customer_id) {
        query += " AND b.customer_id = ?";
        params.push(req.query.customer_id);
    }
    db.all(query, params, (err, rows) => res.json(rows || []));
});

app.post("/bookings", checkAuth, (req, res) => {
    const { customer_id, room_id, check_in, check_out } = req.body;
    db.get("SELECT price FROM rooms WHERE id=?", [room_id], (err, room) => {
        const days = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000*60*60*24));
        const total_price = room.price * days;
        db.run("INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_price) VALUES (?,?,?,?,?)",
            [customer_id, room_id, check_in, check_out, total_price], function(err) {
            res.json({ id: this.lastID, total_price });
        });
    });
});

app.delete("/bookings/:id", checkAdmin, (req, res) => {
    db.run("UPDATE bookings SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ success: true });
});

// ==================== FEEDBACK ====================
app.post("/feedback", checkAuth, (req, res) => {
    const { rating, comment } = req.body;
    db.run("INSERT INTO feedback (user_id, username, rating, comment) VALUES (?,?,?,?)",
        [req.session.user.id, req.session.user.username, rating, comment]);
    res.json({ success: true });
});

app.get("/feedback", checkAuth, (req, res) => {
    db.all("SELECT * FROM feedback ORDER BY created_at DESC", [], (err, rows) => res.json(rows || []));
});

// ==================== HOTEL SETTINGS ====================
app.get("/hotel-settings", checkAuth, (req, res) => {
    db.all("SELECT * FROM hotel_settings", [], (err, rows) => {
        const settings = {};
        rows.forEach(row => settings[row.setting_key] = row.setting_value);
        res.json(settings);
    });
});

// ==================== USERS ====================
app.get("/users", checkAdmin, (req, res) => {
    db.all("SELECT id, username, email, fullname, role FROM users", [], (err, rows) => res.json(rows || []));
});

app.put("/users/:id/role", checkAdmin, (req, res) => {
    db.run("UPDATE users SET role=? WHERE id=?", [req.body.role, req.params.id]);
    res.json({ success: true });
});

app.delete("/users/:id", checkAdmin, (req, res) => {
    db.run("DELETE FROM users WHERE id=? AND username != 'amanuel asefa'", [req.params.id]);
    res.json({ success: true });
});
// ==================== ROOT ROUTE ====================
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/home.html");
});

// Also add a catch-all for static files
app.get("/home.html", (req, res) => {
    res.sendFile(__dirname + "/public/home.html");
});

// ==================== START ====================
app.listen(PORT, () => {
// ==================== START ====================
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
