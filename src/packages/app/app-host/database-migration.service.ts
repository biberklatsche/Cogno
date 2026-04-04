import { Inject, Injectable } from "@angular/core";
import { databaseAccessToken } from "@cogno/app/app-host/app-host.tokens";
import {
  buildDatabaseMigrationIdentifier,
  DatabaseAccessContract,
  DatabaseMigrationContract,
} from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class DatabaseMigrationService {
  private readonly registeredCoreMigrations: DatabaseMigrationContract[] = [];
  private readonly registeredFeatureMigrations: DatabaseMigrationContract[] = [];

  constructor(
    @Inject(databaseAccessToken)
    private readonly databaseAccess: DatabaseAccessContract,
  ) {}

  registerCoreMigrations(databaseMigrations: ReadonlyArray<DatabaseMigrationContract>): void {
    this.registeredCoreMigrations.push(...databaseMigrations);
  }

  registerFeatureMigrations(databaseMigrations: ReadonlyArray<DatabaseMigrationContract>): void {
    this.registeredFeatureMigrations.push(...databaseMigrations);
  }

  async executeMigrations(appDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract>): Promise<void> {
    const allDatabaseMigrations = [
      ...this.registeredCoreMigrations,
      ...appDatabaseMigrations,
      ...this.registeredFeatureMigrations,
    ];

    await this.databaseAccess.execute("PRAGMA foreign_keys = ON;");
    await this.databaseAccess.execute("PRAGMA journal_mode = WAL;");
    await this.databaseAccess.execute("PRAGMA synchronous = NORMAL;");
    await this.databaseAccess.execute("PRAGMA busy_timeout = 5000;");

    await this.databaseAccess.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations
      (
          id TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const appliedMigrations = await this.databaseAccess.select<ReadonlyArray<{ id: string; checksum: string }>>(
      "SELECT id, checksum FROM schema_migrations;",
    );
    const appliedChecksumByIdentifier = new Map(
      appliedMigrations.map((appliedMigration) => [appliedMigration.id, appliedMigration.checksum]),
    );

    const knownMigrationIdentifiers = new Set<string>();

    for (const databaseMigration of allDatabaseMigrations) {
      const migrationIdentifier = buildDatabaseMigrationIdentifier(databaseMigration);
      if (knownMigrationIdentifiers.has(migrationIdentifier)) {
        throw new Error(`Duplicate migration id in code: ${migrationIdentifier}`);
      }
      knownMigrationIdentifiers.add(migrationIdentifier);

      const checksum = await this.sha256(databaseMigration.sql);
      const previousChecksum = appliedChecksumByIdentifier.get(migrationIdentifier);
      if (previousChecksum !== undefined) {
        if (previousChecksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${migrationIdentifier}. ` +
              `DB has ${previousChecksum}, code has ${checksum}. ` +
              `Old migrations must not be edited—create a new migration.`,
          );
        }
        continue;
      }

      await this.databaseAccess.transaction(async (databaseAccess) => {
        await databaseAccess.execute(databaseMigration.sql);
        await databaseAccess.execute("INSERT INTO schema_migrations (id, checksum) VALUES (?, ?);", [
          migrationIdentifier,
          checksum,
        ]);
      });
    }
  }

  private async sha256(content: string): Promise<string> {
    const encodedContent = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest("SHA-256", encodedContent);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}

