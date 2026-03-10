// Compatibility: macOS
import type { CommandSpec } from "../spec.types";
function processIcon(path: string): string {
    const idx = path.indexOf(".app/");
    if (idx === -1) {
        return "fig://icon?type=gear";
    }
    return "fig://" + path.slice(0, idx + 4);
}
const completionSpec: CommandSpec = {
    name: "kill",
    description: "Terminate or signal a process",
    options: [
        {
            name: "-s",
            description: "A symbolic signal name specifying the signal to be sent",
            args: {
                name: "signal_name"
            }
        },
        {
            name: "-l",
            description: "If no operand is given, list the signal names; otherwise, write the signal name corresponding to exit_status",
            args: {
                name: "exit_status"
            }
        }
    ]
};
export default completionSpec;
