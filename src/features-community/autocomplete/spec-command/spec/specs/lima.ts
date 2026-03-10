import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "lima",
    description: 'Lima is an alias for "limactl shell $LIMA_INSTANCE"',
    options: [
        {
            name: ["-h", "--help"],
            description: "Help for lima"
        }
    ]
};
export default completionSpec;
