import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "pdfunite",
    description: "Combine multiple pdfs",
    options: [
        { name: "-v", description: "Print copyright and version info" },
        { name: ["-h", "--help", "-?"], description: "Print usage information" }
    ]
};
export default completionSpec;
