import { createVersionedSpec } from "@fig/autocomplete-helpers";
import type { GetVersionCommand } from "../../spec.types";
const versionFiles = ["2.53.0"];
export const getVersionCommand: GetVersionCommand = async (executeShellCommand) => JSON.parse((await executeShellCommand({
    command: "az",
    args: ["version", "-o", "json"],
})).stdout)["azure-cli"];
export default createVersionedSpec("az", versionFiles);
