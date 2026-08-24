import { Injectable } from "@angular/core";
import { buildDatabaseMigrationIdentifier, DatabaseMigrationContract } from "@cogno/core-api";
import { Database, DatabaseOpenReport } from "@cogno/platform/database";

/**
 * Collects the migrations contributed by core, app and features and hands
 * them to the database when it is opened. Applying them — checksums,
 * transactions, legacy attachment — happens on the Rust side.
 */
@Injectable({ providedIn: "root" })
export class DatabaseMigrationService {
  private readonly registeredCoreMigrations: DatabaseMigrationContract[] = [];
  private readonly registeredFeatureMigrations: DatabaseMigrationContract[] = [];

  registerCoreMigrations(databaseMigrations: ReadonlyArray<DatabaseMigrationContract>): void {
    this.registeredCoreMigrations.push(...databaseMigrations);
  }

  registerFeatureMigrations(databaseMigrations: ReadonlyArray<DatabaseMigrationContract>): void {
    this.registeredFeatureMigrations.push(...databaseMigrations);
  }

  /**
   * Opens the application database and brings it up to date.
   * `legacyDatabasePath` is the previous-generation file that import
   * migrations read from; it may not exist.
   */
  openDatabase(
    appDatabaseMigrations: ReadonlyArray<DatabaseMigrationContract>,
    devMode: boolean,
    legacyDatabasePath: string,
  ): Promise<DatabaseOpenReport> {
    const allDatabaseMigrations = [
      ...this.registeredCoreMigrations,
      ...appDatabaseMigrations,
      ...this.registeredFeatureMigrations,
    ];

    const knownMigrationIdentifiers = new Set<string>();
    const migrations = allDatabaseMigrations.map((databaseMigration) => {
      const id = buildDatabaseMigrationIdentifier(databaseMigration);
      if (knownMigrationIdentifiers.has(id)) {
        throw new Error(`Duplicate migration id in code: ${id}`);
      }
      knownMigrationIdentifiers.add(id);
      return { id, sql: databaseMigration.sql, usesLegacy: databaseMigration.usesLegacy ?? false };
    });

    return Database.open(devMode, migrations, legacyDatabasePath);
  }
}
