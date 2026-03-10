import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "login",
    description: "Begin session on the system",
    options: [
        {
            name: "-p",
            description: "Preserve environment"
        },
        {
            name: "-r",
            description: "Perform autologin protocol for rlogin"
        },
        {
            name: "-h",
            description: "Specify host",
            args: {
                name: "host"
            }
        },
        {
            name: "-f",
            description: "Don't authenticate user, user is preauthenticated"
        }
    ]
};
export default completionSpec;
