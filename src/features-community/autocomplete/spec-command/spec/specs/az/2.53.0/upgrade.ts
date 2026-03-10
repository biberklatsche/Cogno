import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "upgrade",
    description: "Upgrade Azure CLI and extensions",
    options: [
        {
            name: "--all",
            description: "Enable updating extensions as well",
            args: { name: "all" }
        },
        {
            name: ["--yes", "-y"],
            description: "Do not prompt for checking release notes"
        }
    ]
};
export default completion;
