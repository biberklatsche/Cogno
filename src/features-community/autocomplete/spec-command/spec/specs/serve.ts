import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "serve",
    description: "Static file serving and directory listing",
    options: [
        {
            name: ["-h", "--help"],
            description: "Shows help message"
        },
        {
            name: ["-v", "--version"],
            description: "Displays the current version of serve"
        },
        {
            name: ["-l", "--listen"],
            description: "Specify a URI endpoint on which to listen - more than one may be specified to listen in multiple places",
            args: {
                name: "listen_uri"
            }
        },
        {
            name: "-p",
            description: "Specify custom port",
            args: { name: "port" }
        },
        {
            name: ["-d", "--debug"],
            description: "Show debugging information"
        },
        {
            name: ["-s", "--single"],
            description: "Rewrite all not-found requests to `index.html`"
        },
        {
            name: ["-c", "--config"],
            description: "Specify custom path to `serve.json`",
            args: {
                name: "path to config file"
            }
        },
        {
            name: ["-C", "--cors"],
            description: "Enable CORS, sets `Access-Control-Allow-Origin` to `*`"
        },
        {
            name: ["-n", "--no-clipboard"],
            description: "Do not copy the local address to the clipboard"
        },
        {
            name: ["-u", "--no-compression"],
            description: "Do not compress files"
        },
        {
            name: "--no-etag",
            description: "Send `Last-Modified` header instead of `ETag`"
        },
        {
            name: ["-S", "--symlinks"],
            description: "Resolve symlinks instead of showing 404 errors"
        },
        {
            name: "--ssl-cert",
            description: "Optional path to an SSL/TLS certificate to serve with HTTPS",
            args: {
                name: "path to SSL/TLS certificate"
            }
        },
        {
            name: "--ssl-key",
            description: "Optional path to the SSL/TLS certificate's private key",
            args: {
                name: "path to private key"
            }
        },
        {
            name: "--ssl-pass",
            description: "Optional path to the SSL/TLS certificate's passphrase",
            args: {
                name: "path to passphrase"
            }
        },
        {
            name: "--no-port-switching",
            description: "Do not open a port other than the one specified when it's taken"
        }
    ]
};
export default completionSpec;
