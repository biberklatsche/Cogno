import type { Fs, Paths } from "@cogno/platform";
import { beforeEach, describe, expect, it } from "vitest";
import { ConfigFileService } from "./config-file.service";

const SETTINGS = "/home/.claude/settings.json";
const BACKUP = `${SETTINGS}.cogno-backup`;

describe("ConfigFileService", () => {
  let files: Map<string, string>;
  let writes: string[];
  let service: ConfigFileService;

  beforeEach(() => {
    files = new Map();
    writes = [];
    const fs = {
      exists: async (path: string) => files.has(path),
      readTextFile: async (path: string) => files.get(path) ?? "",
      writeTextFile: async (path: string, data: string) => {
        writes.push(path);
        files.set(path, data);
      },
    } as unknown as Fs;
    service = new ConfigFileService(fs, {} as Paths);
  });

  it("keeps the agent's config file as it was before Cogno changed it", async () => {
    files.set(SETTINGS, '{"theme":"dark"}');

    await service.writeJson(SETTINGS, { theme: "dark", hooks: {} });

    expect(files.get(BACKUP)).toBe('{"theme":"dark"}');
    expect(JSON.parse(files.get(SETTINGS) ?? "")).toEqual({ theme: "dark", hooks: {} });
  });

  it("writes neither the file nor a backup when nothing changed", async () => {
    files.set(SETTINGS, JSON.stringify({ hooks: {} }, null, 2));

    await service.writeJson(SETTINGS, { hooks: {} });

    expect(writes).toEqual([]);
  });

  it("makes no backup of a file that did not exist", async () => {
    await service.writeJson(SETTINGS, { hooks: {} });

    expect(files.has(BACKUP)).toBe(false);
    expect(files.has(SETTINGS)).toBe(true);
  });
});
