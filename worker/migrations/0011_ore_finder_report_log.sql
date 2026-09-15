-- Admin-only moderation tooling for Ore Finder: every successful report is
-- logged with its reporting IP (never exposed publicly - separate from the
-- public ore_finder_spawn_history table), and admins can block an IP from
-- reporting again. Additive only - safe to run against the existing
-- production D1 database.

CREATE TABLE ore_finder_report_log (
  id TEXT PRIMARY KEY,
  ip TEXT,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ore_finder_report_log_created_at ON ore_finder_report_log(created_at);
CREATE INDEX idx_ore_finder_report_log_ip ON ore_finder_report_log(ip);

CREATE TABLE ore_finder_blocked_ips (
  ip TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  note TEXT
);
