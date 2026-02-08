
export type RenderPurpose =
    | "display"
    | "insert_arg"
    | "backend_fs";

export type RenderContext = {
    purpose: RenderPurpose;
    /** quoting for insert_arg */
    quoteMode?: "never" | "if-needed" | "always";
};

export interface IPathAdapter {
    normalize(input: string): string;
    render(cognoPath: string, ctx: RenderContext): string | undefined;
}
