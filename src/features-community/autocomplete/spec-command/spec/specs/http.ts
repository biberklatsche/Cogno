import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "http",
    description: "HTTPie: command-line HTTP client for the API era",
    options: [
        {
            name: ["--json", "-j"],
            description: "Data items from the command line are serialized as a JSON object. The Content-Type and Accept headers are set to application/json"
        },
        {
            name: ["--form", "-f"],
            description: `FData items from the command line are serialized as form fields.
The Content-Type is set to application/x-www-form-urlencoded (if not
specified). The presence of any file fields results in a
multipart/form-data request`
        },
        {
            name: "--multipart",
            description: "Similar to --form, but always sends a multipart/form-data request (i.e., even without files)"
        },
        {
            name: "--boundary",
            description: "Specify a custom boundary string for multipart/form-data requests. Has effect only together with --form"
        },
        {
            name: ["--compress", "-x"],
            description: "Content compressed (encoded) with Deflate algorithm. The Content-Encoding header is set to deflate"
        },
        {
            name: "--pretty",
            description: `Controls output processing. The value can be "none" to not prettify
the output (default for redirected output), "all" to apply both colors
and formatting (default for terminal output), "colors", or "format"`
        },
        {
            name: ["--style", "-s"],
            args: {
                name: "STYLE"
            }
        },
        {
            name: "--unsorted",
            description: "Disables all sorting while formatting output"
        },
        {
            name: "--sorted",
            description: "Re-enables all sorting options while formatting output"
        },
        {
            name: "--format-options",
            args: {
                name: "FORMAT_OPTIONS"
            },
            isRepeatable: true,
            description: "Controls output formatting"
        },
        {
            name: ["--print", "-p"],
            args: {
                name: "WHAT"
            },
            description: "String specifying what the output should contain"
        },
        {
            name: ["--headers", "-h"],
            description: "Print only the response headers. Shortcut for --print=h"
        },
        {
            name: ["--body", "-b"],
            description: "Print only the response body. Shortcut for --print=b"
        },
        {
            name: ["--verbose", "-v"],
            description: `Verbose output. Print the whole request as well as the response. Also print
any intermediary requests/responses (such as redirects).
It's a shortcut for: --all --print=BHbh`
        },
        {
            name: "--all",
            description: `By default, only the final request/response is shown. Use this flag to show
any intermediary requests/responses as well. Intermediary requests include
followed redirects (with --follow), the first unauthorized request when
Digest auth is used (--auth=digest), etc`
        },
        {
            name: ["--history-print", "-P"],
            args: {
                name: "WHAT"
            },
            description: `The same as --print, -p but applies only to intermediary requests/responses
(such as redirects) when their inclusion is enabled with --all. If this
options is not specified, then they are formatted the same way as the final
response`
        },
        {
            name: ["--stream", "-S"],
            description: "Always stream the response body by line, i.e., behave like `tail -f'"
        },
        {
            name: ["--output", "-o"],
            args: {
                name: "FILE"
            },
            description: `Save output to FILE instead of stdout. If --download is also set, then only
the response body is saved to FILE. Other parts of the HTTP exchange are
printed to stderr`
        },
        {
            name: ["--download", "-d"],
            description: `Do not print the response body to stdout. Rather, download it and store it
in a file. The filename is guessed unless specified with --output
[filename]. This action is similar to the default behaviour of wget`
        },
        {
            name: ["--continue", "-c"],
            description: "Resume an interrupted download. Note that the --output option needs to be specified as well"
        },
        {
            name: ["--quiet", "-q"],
            description: `Do not print to stdout or stderr.
stdout is still redirected if --output is specified.
Flag doesn't affect behaviour of download beyond not printing to terminal`
        },
        {
            name: "--session",
            args: {
                name: "SESSION_NAME_OR_PATH"
            },
            description: `Create, or reuse and update a session. Within a session, custom headers,
auth credential, as well as any cookies sent by the server persist between
requests`
        },
        {
            name: "--session-read-only",
            args: {
                name: "SESSION_NAME_OR_PATH"
            },
            description: "Create or read a session without updating it form the request/response exchange"
        },
        {
            name: ["--auth", "-a"],
            args: {
                name: "USER[:PASS]"
            },
            description: "If only the username is provided (-a username), HTTPie will prompt for the password"
        },
        {
            name: ["--auth-type", "-A"],
            description: 'The authentication mechanism to be used. Defaults to "basic"'
        },
        {
            name: "--ignore-netrc",
            description: "Ignore credentials from .netrc"
        },
        {
            name: "--offline",
            description: "Build the request and print it but don’t actually send it"
        },
        {
            name: "--proxy",
            args: {
                name: "PROTOCOL:PROXY_URL"
            },
            description: `String mapping protocol to the URL of the proxy
(e.g. http:http://foo.bar:3128). You can specify multiple proxies with
different protocols. The environment variables $ALL_PROXY, $HTTP_PROXY,
and $HTTPS_proxy are supported as well`
        },
        {
            name: ["--follow", "-F"],
            description: "Follow 30x Location redirects"
        },
        {
            name: "--max-redirects",
            args: {
                name: "MAX_REDIRECTS"
            },
            description: "By default, requests have a limit of 30 redirects (works with --follow)"
        },
        {
            name: "--max-headers",
            args: {
                name: "MAX_HEADERS"
            },
            description: "The maximum number of response headers to be read before giving up (default 0, i.e., no limit)"
        },
        {
            name: "--timeout",
            args: {
                name: "SECONDS"
            },
            description: `The connection timeout of the request in seconds.
The default value is 0, i.e., there is no timeout limit`
        },
        {
            name: "--check-status",
            description: `By default, HTTPie exits with 0 when no network or other fatal errors
occur. This flag instructs HTTPie to also check the HTTP status code and
exit with an error if the status indicates one`
        },
        {
            name: "--path-as-is",
            description: "Bypass dot segment (/../ or /./) URL squashing"
        },
        {
            name: "--chunked",
            description: "Enable streaming via chunked transfer encoding"
        },
        {
            name: "--verify",
            args: {
                name: "VERIFY"
            },
            description: `Set to "no" (or "false") to skip checking the host's SSL certificate.
Defaults to "yes" ("true"). You can also pass the path to a CA_BUNDLE file
for private certs`
        },
        {
            name: "--ssl",
            description: `The desired protocol version to use. This will default to
SSL v2.3 which will negotiate the highest protocol that both
the server and your installation of OpenSSL support`
        },
        {
            name: "--ciphers",
            description: "A string in the OpenSSL cipher list format"
        },
        {
            name: "--cert",
            description: `You can specify a local cert to use as client side SSL certificate.
This file may either contain both private key and certificate or you may
specify --cert-key separately`
        },
        {
            name: "--cert-key",
            description: "The private key to use with SSL. Only needed if --cert is given and the certificate file does not contain the private key"
        },
        {
            name: ["--ignore-stdin", "-I"],
            description: "Do not attempt to read stdin"
        },
        {
            name: "--help",
            description: "Show the help message and exit"
        },
        {
            name: "--version",
            description: "Show version and exit"
        },
        {
            name: "--traceback",
            description: "Prints the exception traceback should one occur"
        },
        {
            name: "--default-scheme",
            args: {
                name: "DEFAULT_SCHEME"
            },
            description: "The default scheme to use if not specified in the URL"
        },
        {
            name: "--debug",
            description: `Prints the exception traceback should one occur, as well as other
information useful for debugging HTTPie itself and for reporting bugs`
        }
    ]
};
export default completionSpec;
