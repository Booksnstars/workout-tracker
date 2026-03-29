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
