import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "wscat",
    description: "Communicate over websocket",
    options: [
        {
            name: ["-c", "--connect"],
            args: {
                name: "url"
            },
            description: "Connect to a WebSocket server"
        },
        { name: ["-V", "--version"], description: "Output the version number" },
        {
            name: "--auth",
            description: "Add basic HTTP authentication header (--connect only)",
            args: { name: "username:password" }
        },
        {
            name: "--ca",
            args: {
                name: "ca"
            },
            description: "Specify a Certificate Authority (--connect only)"
        },
        {
            name: "--cert",
            args: {
                name: "cert"
            },
            description: "Specify a Client SSL Certificate (--connect only)"
        },
        {
            name: "--host",
            args: {
                name: "host"
            },
            description: "Optional host"
        },
        {
            name: "--key",
            args: {
                name: "key"
            },
            description: "Specify a Client SSL Certificate's key (--connect only)"
        },
        {
            name: "--max-redirects",
            args: {
                name: "num"
            },
            description: "Maximum number of redirects allowed (--connect only) (default: 10)"
        },
        { name: "--no-color", description: "Run without color" },
        {
            name: "--passphrase",
            args: {
                name: "passphrase"
            },
            description: "Specify a Client SSL Certificate Key's passphrase (--connect only). If you don't provide a value, it will be prompted for"
        },
        {
            name: "--proxy",
            args: {
                name: "[protocol://]host[:port]"
            },
            description: "Connect via a proxy. Proxy must support CONNECT method"
        },
        {
            name: "--slash",
            description: "Enable slash commands for control frames (/ping, /pong, /close [code [, reason]])"
        },
        {
            name: ["-H", "--header"],
            args: {
                name: "header:value"
            },
            description: "Set an HTTP header. Repeat to set multiple (--connect only) (default: [])"
        },
        {
            name: ["-L", "--location"],
            description: "Follow redirects (--connect only)"
        },
        {
            name: ["-l", "--listen"],
            args: {
                name: "port"
            },
            description: "Listen on port"
        },
        {
            name: ["-n", "--no-check"],
            description: "Do not check for unauthorized certificates"
        },
        {
            name: ["-o", "--origin"],
            args: {
                name: "origin"
            },
            description: "Optional origin"
        },
        {
            name: ["-p", "--protocol"],
            args: {
                name: "protocol"
            },
            description: "Optional protocol version"
        },
        {
            name: ["-P", "--show-ping-pong"],
            description: "Print a notification when a ping or pong is received"
        },
        {
            name: ["-s", "--subprotocol"],
            args: {
                name: "protocol"
            },
            description: "Optional subprotocol (default: [])"
        },
        {
            name: ["-w", "--wait"],
            args: {
                name: "seconds"
            },
            description: "Wait given seconds after executing command"
        },
        {
            name: ["-x", "--execute"],
            args: {
                name: "command"
            },
            description: "Execute command after connecting"
        },
        { name: ["-h", "--help"], description: "Display help for command" }
    ]
};
export default completionSpec;
