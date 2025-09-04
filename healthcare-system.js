const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "data.db"));
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT,
  dob TEXT
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patientId TEXT,
  doctorId TEXT,
  datetime TEXT,
  reason TEXT,
  status TEXT
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  appointmentId TEXT,
  patientId TEXT,
  doctorId TEXT,
  notes TEXT,
  medicines TEXT,
  createdAt TEXT
);
`);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, dob } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: "Missing fields" });
  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  try {
    db.prepare("INSERT INTO users (id,name,email,password,role,dob) VALUES (?,?,?,?,?,?)")
      .run(id, name, email, hashed, role, dob || null);
    res.json({ id, name, email, role });
  } catch {
    res.status(400).json({ error: "Email exists" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!row) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, row.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  delete row.password;
  res.json({ user: row });
});

app.get("/api/users/doctors", (req, res) => {
  const rows = db.prepare("SELECT id,name,email,dob FROM users WHERE role='doctor'").all();
  res.json(rows);
});
app.post("/api/appointments", (req, res) => {
  const { patientId, doctorId, datetime, reason } = req.body;
  const id = uuidv4();
  db.prepare("INSERT INTO appointments (id,patientId,doctorId,datetime,reason,status) VALUES (?,?,?,?,?,?)")
    .run(id, patientId, doctorId, datetime, reason || "", "scheduled");
  res.json({ id, patientId, doctorId, datetime, reason, status: "scheduled" });
});

app.get("/api/appointments/user/:userId", (req, res) => {
  const rows = db.prepare("SELECT * FROM appointments WHERE patientId=? OR doctorId=?").all(req.params.userId, req.params.userId);
  res.json(rows);
});

app.post("/api/prescriptions", (req, res) => {
  const { appointmentId, patientId, doctorId, notes, medicines } = req.body;
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare("INSERT INTO prescriptions (id,appointmentId,patientId,doctorId,notes,medicines,createdAt) VALUES (?,?,?,?,?,?,?)")
    .run(id, appointmentId, patientId, doctorId, notes || "", medicines || "", createdAt);
  res.json({ id, createdAt });
});

app.get("/api/prescriptions/patient/:id", (req, res) => {
  const rows = db.prepare("SELECT * FROM prescriptions WHERE patientId=?").all(req.params.id);
  res.json(rows);
});
(async () => {
  const user = db.prepare("SELECT * FROM users WHERE email=?").get("patient@example.com");
  if (!user) {
    const pass1 = await bcrypt.hash("patient123", 10);
    const pass2 = await bcrypt.hash("doctor123", 10);
    db.prepare("INSERT INTO users (id,name,email,password,role,dob) VALUES (?,?,?,?,?,?)")
      .run(uuidv4(), "Patient A", "patient@example.com", pass1, "patient", "1958-05-10");
    db.prepare("INSERT INTO users (id,name,email,password,role,dob) VALUES (?,?,?,?,?,?)")
      .run(uuidv4(), "Dr. Rao", "doctor@example.com", pass2, "doctor", "1975-02-02");
    console.log("Demo accounts seeded ✅");
  }
})();

const PORT = 4000;
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
