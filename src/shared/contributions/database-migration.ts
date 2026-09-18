export interface DatabaseMigrationContract {
  readonly source: string;
  readonly name: string;
  readonly sql: string;
  /**
   * The step reads from the previous-generation database, which is attached
   * as `legacy` while it runs. It is skipped when no such file exists.
   */
  readonly usesLegacy?: boolean;
}

export interface DatabaseMigrationDefinitionContract {
  readonly name: string;
  readonly sql: string;
  readonly usesLegacy?: boolean;
}

export function buildDatabaseMigrationIdentifier(
  databaseMigration: Pick<DatabaseMigrationContract, "source" | "name">,
): string {
  return `${databaseMigration.source}/${databaseMigration.name}`;
}

export function registerDatabaseMigrations(
  source: string,
  databaseMigrationDefinitions: ReadonlyArray<DatabaseMigrationDefinitionContract>,
): ReadonlyArray<DatabaseMigrationContract> {
  return databaseMigrationDefinitions.map((databaseMigrationDefinition) => ({
    source,
    name: databaseMigrationDefinition.name,
    sql: databaseMigrationDefinition.sql,
    usesLegacy: databaseMigrationDefinition.usesLegacy,
  }));
}
