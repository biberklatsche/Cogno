type RenderPurpose = "display" | "insert_arg" | "backend_fs";

export type RenderContext = {
  purpose: RenderPurpose;
  quoteMode?: "never" | "if-needed" | "always";
};

export interface IPathAdapter {
  normalize(input: string): string;
  render(cognoPath: string, ctx: RenderContext): string | undefined;
  parentOf(cognoPath: string): string | null;
  basenameOf(cognoPath: string): string;
  depthOf(cognoPath: string): number;
}

/**
 * `path` relative to the directory `base`, both normalized Cogno paths (see
 * `IPathAdapter.normalize`); undefined when `path` does not lie inside `base`.
 */
export function relativeCognoPath(base: string, path: string): string | undefined {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return path.startsWith(prefix) && path.length > prefix.length
    ? path.slice(prefix.length)
    : undefined;
}
