// src/db/migrate.ts
// Migrationen als raw strings bundlen:
import m001 from "./001_init_workspace.sql?raw";
import m002 from "./002_add_workspace_autosave.sql?raw";
import {DB} from "../_tauri/db";

type Migration = { id: string; sql: string };

const MIGRATIONS: Migration[] = [
    {id: "001_init_workspace", sql: m001},
    {id: "002_add_workspace_autosave", sql: m002},
].sort((a, b) => a.id.localeCompare(b.id));

async function sha256(text: string): Promise<string> {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function migrate() {
    // Runtime PRAGMAs (on every open)
    await DB.execute(`PRAGMA foreign_keys = ON;`);
    await DB.execute(`PRAGMA journal_mode = WAL;`);
    await DB.execute(`PRAGMA synchronous = NORMAL;`);

    // Bootstrap: migrations table
    await DB.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations
        (
            id TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const applied = await DB.select<{ id: string; checksum: string }[]>(
        'SELECT id, checksum FROM schema_migrations;'
    );
    const appliedMap = new Map(applied.map(r => [r.id, r.checksum]));

    for (const m of MIGRATIONS) {
        const cs = await sha256(m.sql);

        if (appliedMap.has(m.id)) {
            const prev = appliedMap.get(m.id);
            if (prev !== cs) {
                throw new Error(
                    `Migration checksum mismatch for ${m.id}. ` +
                    `DB has ${prev}, code has ${cs}. ` +
                    `Old migrations must not be edited—create a new migration.`
                );
            }
            continue;
        }

        await DB.execute("BEGIN;");
        try {
            await DB.execute(m.sql);
            await DB.execute(
                'INSERT INTO schema_migrations (id, checksum) VALUES (?, ?);',
                [m.id, cs]
            );
            await DB.execute("COMMIT;");
        } catch (e) {
            await DB.execute("ROLLBACK;");
            throw e;
        }
    }
}
