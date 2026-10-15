import { describe, expect, it } from "vitest";
import { buildFileTree, GitFileTreeRow } from "./git-file-tree";
import { GitFile } from "./git-model";

const file = (path: string): GitFile => ({ path, status: "M", isDirectory: false });
const describeRow = (row: GitFileTreeRow) =>
  `${"  ".repeat(row.depth)}${row.kind === "dir" ? `${row.name}/` : row.name}`;

describe("buildFileTree", () => {
  it("lists folders before files and merges single-child folder chains", () => {
    const rows = buildFileTree([
      file("README.md"),
      file("src/app/a.ts"),
      file("src/app/b.ts"),
      file("docs/x.md"),
    ]);

    expect(rows.map(describeRow)).toEqual([
      "docs/",
      "  x.md",
      "src/app/",
      "  a.ts",
      "  b.ts",
      "README.md",
    ]);
  });

  it("leaves out what is below a collapsed folder", () => {
    const rows = buildFileTree(
      [file("src/a.ts"), file("src/lib/b.ts"), file("c.ts")],
      new Set(["src"]),
    );

    expect(rows.map(describeRow)).toEqual(["src/", "c.ts"]);
  });

  it("keys folders by their full path", () => {
    const rows = buildFileTree([file("a/b/c.ts"), file("a/d.ts")]);

    expect(
      rows.filter((row) => row.kind === "dir").map((row) => (row.kind === "dir" ? row.path : "")),
    ).toEqual(["a", "a/b"]);
  });
});
