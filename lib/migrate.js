function getTableColumns(db, tableName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);
}

function createBattlesTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      questions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      UNIQUE(topic_id, level)
    );
  `);
}

function migrateBattlesTable(db) {
  const tables = db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'battles'
    `)
    .all();

  if (tables.length === 0) {
    createBattlesTable(db);
    return;
  }

  const columns = getTableColumns(db, "battles");

  if (columns.includes("level")) {
    return;
  }

  db.exec(`
    CREATE TABLE battles_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      questions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      UNIQUE(topic_id, level)
    );

    INSERT INTO battles_new (id, topic_id, level, questions, created_at)
    SELECT id, topic_id, 1, questions, created_at
    FROM battles;

    DROP TABLE battles;
    ALTER TABLE battles_new RENAME TO battles;
  `);

  console.log("Migrated battles table to support levels.");
}

function createBattleProgressTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS battle_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      stars INTEGER NOT NULL DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      UNIQUE(user_id, topic_id, level)
    );
  `);
}

export function runMigrations(db) {
  migrateBattlesTable(db);
  createBattleProgressTable(db);
}
