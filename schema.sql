CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  duration TEXT,
  notes TEXT,
  exercises TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  class_name TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Run once to add user ownership columns (will error if already applied, that's fine)
ALTER TABLE workouts ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE classes ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Run once to add duration to classes (will error if already applied, that's fine)
ALTER TABLE classes ADD COLUMN duration INTEGER;
