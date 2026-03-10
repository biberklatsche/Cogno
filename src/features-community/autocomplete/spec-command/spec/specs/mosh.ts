import { knownHosts, configHosts } from "./ssh";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "mosh",
    description: "",
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for mosh"
        },
        {
            name: "--client",
            description: 'Mosh client on local machine (default: "mosh-client")'
        },
        {
            name: "--server",
            description: 'Mosh server on remote machine (default: "mosh-server")'
        },
        {
            name: "--predict",
            description: "Local echo options"
        },
        {
            name: "-4",
            description: "Use IPv4 only"
        },
        {
            name: "-6",
            description: "Use IPv6 only"
        },
        {
            name: "--family",
            description: "Network Type"
        },
        {
            name: ["--port", "-p"],
            description: "Server-side UDP port or range, (No effect on server-side SSH port)"
        },
        {
            name: "--bind-server",
            description: '{ssh|any|IP}, ask the server to reply from an IP address, (default: "ssh")'
        },
        {
            name: "--ssh",
            args: {
                name: "command"
            },
            description: 'Ssh command to run when setting up session, (example: "ssh -p 2222")'
        },
        {
            name: "--no-ssh-pty",
            description: "Do not allocate a pseudo tty on ssh connection"
        },
        {
            name: "--no-init",
            description: "Do not send terminal initialization string"
        },
        {
            name: "--local",
            description: "Run mosh-server locally without using ssh"
        },
        {
            name: "--experimental-remote-ip",
            description: "Select the method for discovering the remote IP address to use for mosh",
            args: {
                name: "method"
            }
        },
        {
            name: "--version",
            description: "Version and copyright information"
        }
    ]
};
export default completionSpec;
