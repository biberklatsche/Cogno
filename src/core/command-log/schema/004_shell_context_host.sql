-- A shell can run on another machine (`remote.hosts`). Its commands and
-- directories are that machine's, so the machine is part of what makes a
-- context: `host` is its name there, '' for the machine Cogno runs on.
--
-- The UNIQUE constraint of a table cannot be changed in place, so the table
-- is built again with the same ids. The other tables refer to it by name and
-- find the new one under it.
--
-- The order matters. Dropping the old table leaves the rows of the other
-- tables without their context, which is only tolerated until the commit.
-- SQLite counts such rows and takes them off the count again when the row
-- they refer to is inserted - into the table of that name. So the contexts
-- wait in a temporary table and go into the new one after it got its name.
PRAGMA defer_foreign_keys = ON;

CREATE TEMP TABLE shell_context_kept AS
SELECT id, backend_os, shell_type, wsl_distro, created_at
FROM shell_context;

DROP TABLE shell_context;

CREATE TABLE shell_context (
    id          INTEGER PRIMARY KEY,
    backend_os  TEXT    NOT NULL,
    shell_type  TEXT    NOT NULL,
    wsl_distro  TEXT    NOT NULL DEFAULT '',
    host        TEXT    NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    UNIQUE (backend_os, shell_type, wsl_distro, host)
);

INSERT INTO shell_context (id, backend_os, shell_type, wsl_distro, host, created_at)
SELECT id, backend_os, shell_type, wsl_distro, '', created_at
FROM shell_context_kept;

DROP TABLE shell_context_kept;
