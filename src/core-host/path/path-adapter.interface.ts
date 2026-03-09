export type RenderPurpose =
    | "display"
    | "insert_arg"
    | "backend_fs";

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
