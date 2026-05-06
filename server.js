const express = require("express");
const session = require("express-session");
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// ==================== CREATE DATA DIRECTORY FOR RENDER ====================
const dataDir = '/opt/render/project/src/data';
const dbPath = process.env.NODE_ENV === 'production' 
    ? path.join(dataDir, 'hotel.db')
    : path.join(__dirname, 'hotel.db');

// Create directory if it doesn't exist (for Render)
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from current directory
app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: "hotel_secret_key_2024",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ==================== DATABASE SETUP ====================
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT,
        fullname TEXT,
        role TEXT DEFAULT 'user'
    )`);

    // Rooms table
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT,
        type TEXT,
        price REAL,
        image_url TEXT
    )`);

    // Customers table
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        user_id INTEGER
    )`);

    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        room_id INTEGER,
        check_in TEXT,
        check_out TEXT,
        total_price REAL,
        status TEXT DEFAULT 'active'
    )`);

    // Room Types table
    db.run(`CREATE TABLE IF NOT EXISTS room_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        is_premium INTEGER DEFAULT 0,
        image_key TEXT DEFAULT 'standard'
    )`);

    // Feedback table
    db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        rating INTEGER,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Hotel Settings table
    db.run(`CREATE TABLE IF NOT EXISTS hotel_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE,
        setting_value TEXT
    )`);

    // Insert default room types
    const defaultTypes = [
        'Presidential Suite', 'Executive Suite', 'Deluxe Room', 
        'Premium Double', 'Standard Double', 'Standard Single'
    ];
    defaultTypes.forEach((type, index) => {
        const isPremium = index < 2 ? 1 : 0;
        db.run(`INSERT OR IGNORE INTO room_types (name, is_premium) VALUES (?, ?)`, [type, isPremium]);
    });

    // Insert default hotel settings
    db.run(`INSERT OR IGNORE INTO hotel_settings (setting_key, setting_value) VALUES 
        ('hotel_name', 'HotelSuite Luxury'),
        ('hotel_city', 'New Delhi'),
        ('hotel_lat', '28.6139'),
        ('hotel_lon', '77.2090')`);

    // Create default manager user
    db.get("SELECT * FROM users WHERE username = 'amanuel asefa'", async (err, row) => {
        if (!row && !err) {
            const hashedPassword = await bcrypt.hash("emanu#1259$", saltRounds);
            db.run("INSERT INTO users (username, password, role, fullname) VALUES (?, ?, ?, ?)",
                ["amanuel asefa", hashedPassword, "manager", "Amanuel Asefa"]);
            console.log("✅ Default manager created");
        }
    });

    console.log("✅ Database initialized at:", dbPath);
});

// ==================== AUTH MIDDLEWARE ====================
function checkAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}

function checkAdmin(req, res, next) {
    if (!req.session.user || (req.session.user.role !== "admin" && req.session.user.role !== "manager")) {
        return res.status(403).json({ error: "Access denied" });
    }
    next();
}

// ==================== AUTH ROUTES ====================
app.post("/api/register", async (req, res) => {
    const { username, password, email, fullname } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        db.run("INSERT INTO users (username, password, email, fullname, role) VALUES (?, ?, ?, ?, ?)",
            [username, hashedPassword, email || null, fullname || username, "user"],
            function(err) {
                if (err) {
                    return res.status(400).json({ error: "Username already exists" });
                }
                res.json({ success: true, id: this.lastID });
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        
        res.json({ 
            success: true, 
            role: user.role,
            username: user.username,
            id: user.id
        });
    });
});

app.get("/api/me", (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: "Not logged in" });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// ==================== ROOM ROUTES ====================
app.get("/api/rooms", checkAuth, (req, res) => {
    db.all("SELECT * FROM rooms ORDER BY id", [], (err, rows) => {
        res.json(rows || []);
    });
});

app.post("/api/rooms", checkAdmin, (req, res) => {
    const { number, type, price } = req.body;
    db.run("INSERT INTO rooms (number, type, price) VALUES (?, ?, ?)",
        [number, type, price],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID });
        });
});

app.delete("/api/rooms/:id", checkAdmin, (req, res) => {
    db.run("DELETE FROM rooms WHERE id = ?", [req.params.id], () => {
        res.json({ success: true });
    });
});

// ==================== ROOM TYPES ====================
app.get("/api/room-types", checkAuth, (req, res) => {
    db.all("SELECT * FROM room_types ORDER BY is_premium DESC", [], (err, rows) => {
        res.json(rows || []);
    });
});

// ==================== CUSTOMER ROUTES ====================
app.get("/api/customers", checkAuth, (req, res) => {
    let query = "SELECT c.*, u.username FROM customers c LEFT JOIN users u ON c.user_id = u.id";
    let params = [];
    
    if (req.query.user_id) {
        query += " WHERE c.user_id = ?";
        params.push(req.query.user_id);
    }
    
    db.all(query, params, (err, rows) => {
        res.json(rows || []);
    });
});

app.post("/api/customers", checkAuth, (req, res) => {
    const { name, phone, user_id } = req.body;
    const customerUserId = user_id || req.session.user.id;
    
    db.run("INSERT INTO customers (name, phone, user_id) VALUES (?, ?, ?)",
        [name, phone, customerUserId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID });
        });
});

app.put("/api/customers/:id", checkAuth, (req, res) => {
    const { name, phone } = req.body;
    db.run("UPDATE customers SET name = ?, phone = ? WHERE id = ?",
        [name, phone, req.params.id],
        () => {
            res.json({ success: true });
        });
});

// ==================== BOOKING ROUTES ====================
app.get("/api/bookings", checkAuth, (req, res) => {
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
    
    db.all(query, params, (err, rows) => {
        res.json(rows || []);
    });
});

app.post("/api/bookings", checkAuth, (req, res) => {
    const { customer_id, room_id, check_in, check_out } = req.body;
    
    if (!customer_id || !room_id || !check_in || !check_out) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    db.get("SELECT price FROM rooms WHERE id = ?", [room_id], (err, room) => {
        if (err || !room) {
            return res.status(404).json({ error: "Room not found" });
        }
        
        const start = new Date(check_in);
        const end = new Date(check_out);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const total_price = room.price * days;
        
        db.run(`INSERT INTO bookings (customer_id, room_id, check_in, check_out, total_price) 
                VALUES (?, ?, ?, ?, ?)`,
            [customer_id, room_id, check_in, check_out, total_price],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID, total_price });
            });
    });
});

app.delete("/api/bookings/:id", checkAdmin, (req, res) => {
    db.run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id], () => {
        res.json({ success: true });
    });
});

// ==================== FEEDBACK ROUTES ====================
app.post("/api/feedback", checkAuth, (req, res) => {
    const { rating, comment } = req.body;
    db.run("INSERT INTO feedback (user_id, username, rating, comment) VALUES (?, ?, ?, ?)",
        [req.session.user.id, req.session.user.username, rating, comment],
        function(err) {
            res.json({ success: true, id: this.lastID });
        });
});

app.get("/api/feedback", checkAuth, (req, res) => {
    db.all("SELECT * FROM feedback ORDER BY created_at DESC", [], (err, rows) => {
        res.json(rows || []);
    });
});

// ==================== USER MANAGEMENT ====================
app.get("/api/users", checkAdmin, (req, res) => {
    db.all("SELECT id, username, email, fullname, role FROM users", [], (err, rows) => {
        res.json(rows || []);
    });
});

app.put("/api/users/:id/role", checkAdmin, (req, res) => {
    const { role } = req.body;
    db.run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id], () => {
        res.json({ success: true });
    });
});

app.delete("/api/users/:id", checkAdmin, (req, res) => {
    db.run("DELETE FROM users WHERE id = ? AND username != 'amanuel asefa'", [req.params.id], () => {
        res.json({ success: true });
    });
});

// ==================== HOTEL SETTINGS ====================
app.get("/api/hotel-settings", checkAuth, (req, res) => {
    db.all("SELECT * FROM hotel_settings", [], (err, rows) => {
        const settings = {};
        if (rows) {
            rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
        }
        res.json(settings);
    });
});

// ==================== SERVE HTML PAGES ====================
const htmlFiles = [
    '', 'home', 'login', 'register', 'index', 'manager', 'user',
    'rooms', 'bookings', 'customers', 'suites', 'services',
    'experiences', 'testimonials', 'contact', 'support'
];

htmlFiles.forEach(file => {
    const route = file === '' ? '/' : `/${file}.html`;
    const htmlFile = file === '' ? 'home.html' : `${file}.html`;
    
    app.get(route, (req, res) => {
        const filePath = path.join(__dirname, htmlFile);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send(`File ${htmlFile} not found`);
        }
    });
});

// Catch-all for any other .html files
app.get('/*.html', (req, res) => {
    const fileName = req.params[0] + '.html';
    const filePath = path.join(__dirname, fileName);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Database path: ${dbPath}`);
    console.log(`✅ Static files from: ${__dirname}`);
});
