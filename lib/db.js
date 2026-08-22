import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root = parent of lib/
const projectRoot = path.join(__dirname, "..");

const dataDir = path.join(projectRoot, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "education.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");

// Run schema initialization
import("./schema.js").catch(() => {});

console.log("Database:", dbPath);

export default db;