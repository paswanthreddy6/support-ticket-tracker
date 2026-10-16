require("dotenv").config();

const path = require("node:path");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcrypt");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const database = require("./db");

const app = express();
const port = Number(process.env.PORT) || 3000;
const clientOrigins = (process.env.CLIENT_ORIGIN || `http://localhost:${port}`)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("SESSION_SECRET must be at least 32 characters in production.");
}

app.disable("x-powered-by");
app.use(cors({
  origin: clientOrigins,
  credentials: true
}));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.db", dir: path.resolve("data") }),
  secret: process.env.SESSION_SECRET || "development-only-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Try again later." }
});

app.use(express.static(path.resolve(".")));

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireUser(request, response, next) {
  if (!request.session.userId) return next(httpError(401, "You must be signed in."));
  next();
}

function validateCredentials(body) {
  body = body && typeof body === "object" ? body : {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "A valid email is required.");
  if (password.length < 8 || password.length > 72) throw httpError(400, "Password must be 8 to 72 characters.");
  return { email, password };
}

function validateTicket(body) {
  body = body && typeof body === "object" ? body : {};
  const fields = ["title", "requester", "category", "priority", "description"];
  const ticket = Object.fromEntries(fields.map((field) => [field, typeof body[field] === "string" ? body[field].trim() : ""]));
  if (fields.some((field) => !ticket[field])) throw httpError(400, "All ticket fields are required.");
  if (ticket.title.length > 100 || ticket.requester.length > 80 || ticket.description.length > 1000) {
    throw httpError(400, "Ticket text exceeds the allowed length.");
  }
  if (!["Hardware", "Software", "Access", "Network", "Other"].includes(ticket.category)) {
    throw httpError(400, "Invalid category.");
  }
  if (!["Low", "Medium", "High"].includes(ticket.priority)) throw httpError(400, "Invalid priority.");
  return ticket;
}

function mapTicket(ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    requester: ticket.requester,
    category: ticket.category,
    priority: ticket.priority,
    description: ticket.description,
    status: ticket.status,
    createdAt: ticket.created_at
  };
}

app.get("/api/health", (request, response) => response.json({ status: "ok" }));

app.post("/api/auth/register", authLimiter, async (request, response, next) => {
  try {
    const { email, password } = validateCredentials(request.body);
    const passwordHash = await bcrypt.hash(password, 12);
    const result = database.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, passwordHash);
    request.session.userId = result.lastInsertRowid;
    response.status(201).json({ user: { id: result.lastInsertRowid, email } });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return next(httpError(409, "An account with that email already exists."));
    next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (request, response, next) => {
  try {
    const { email, password } = validateCredentials(request.body);
    const user = database.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return next(httpError(401, "Invalid email or password."));
    }
    request.session.regenerate((error) => {
      if (error) return next(error);
      request.session.userId = user.id;
      response.json({ user: { id: user.id, email: user.email } });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireUser, (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie("connect.sid");
    response.status(204).end();
  });
});

app.get("/api/auth/me", requireUser, (request, response) => {
  const user = database.prepare("SELECT id, email FROM users WHERE id = ?").get(request.session.userId);
  if (!user) return response.status(401).json({ error: "Session is no longer valid." });
  response.json({ user });
});

app.get("/api/tickets", (request, response) => {
  const rows = database.prepare("SELECT * FROM tickets ORDER BY created_at DESC, id DESC").all();
  response.json({ tickets: rows.map(mapTicket) });
});

app.post("/api/tickets", (request, response, next) => {
  try {
    const ticket = validateTicket(request.body);
    const result = database.prepare(`
      INSERT INTO tickets (title, requester, category, priority, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(ticket.title, ticket.requester, ticket.category, ticket.priority, ticket.description);
    const created = database.prepare("SELECT * FROM tickets WHERE id = ?").get(result.lastInsertRowid);
    response.status(201).json({ ticket: mapTicket(created) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tickets/:id/status", (request, response, next) => {
  try {
    const status = typeof request.body.status === "string" ? request.body.status : "";
    if (!["Open", "In Progress", "Resolved"].includes(status)) throw httpError(400, "Invalid status.");
    const result = database.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(status, request.params.id);
    if (!result.changes) throw httpError(404, "Ticket not found.");
    const ticket = database.prepare("SELECT * FROM tickets WHERE id = ?").get(request.params.id);
    response.json({ ticket: mapTicket(ticket) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tickets/:id", (request, response, next) => {
  try {
    const result = database.prepare("DELETE FROM tickets WHERE id = ?").run(request.params.id);
    if (!result.changes) throw httpError(404, "Ticket not found.");
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((request, response) => response.status(404).json({ error: "Route not found." }));
app.use((error, request, response, next) => {
  const status = error.type === "entity.parse.failed"
    ? 400
    : Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  const message = error.type === "entity.parse.failed" ? "Request body must be valid JSON." : error.message;
  response.status(status).json({ error: status >= 500 ? "Internal server error." : message });
});

if (require.main === module) {
  app.listen(port, () => console.log(`Support Desk API listening on http://localhost:${port}`));
}

module.exports = app;
