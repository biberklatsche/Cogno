export interface DatabaseMigrationContract {
  readonly source: string;
  readonly name: string;
  readonly sql: string;
}

export interface DatabaseMigrationDefinitionContract {
  readonly name: string;
  readonly sql: string;
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
  }));
}


