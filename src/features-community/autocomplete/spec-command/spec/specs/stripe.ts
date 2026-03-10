import type { CommandSpec, OptionSpec, Suggestion } from "../spec.types";
const webhookSuggestions: Suggestion[] = [
    {
        name: "balance.available",
        description: "Occurs whenever your Stripe balance has been updated (e.g., when a charge is available to be paid out). By default, Stripe automatically transfers funds in your balance to your bank account on a daily basis",
    },
    {
        name: "charge.captured",
        description: "Occurs whenever a previously uncaptured charge is captured",
    },
    {
        name: "charge.dispute.created",
        description: "Occurs whenever a customer disputes a charge with their bank",
    },
    {
        name: "charge.failed",
        description: "Occurs whenever a failed charge attempt occurs",
    },
    {
        name: "charge.refunded",
        description: "Occurs whenever a charge is refunded, including partial refunds",
    },
    {
        name: "charge.succeeded",
        description: "Occurs whenever a new charge is created and is successful",
    },
    {
        name: "checkout.session.completed",
        description: "Occurs when a Checkout Session has been successfully completed",
    },
    {
        name: "customer.created",
        description: "Occurs whenever a new customer is created",
    },
    {
        name: "customer.deleted",
        description: "Occurs whenever a customer is deleted",
    },
    {
        name: "customer.source.created",
        description: "Occurs whenever a new source is created for a customer",
    },
    {
        name: "customer.source.updated",
        description: "Occurs whenever a source's details are changed",
    },
    {
        name: "customer.subscription.created",
        description: "Occurs whenever a customer is signed up for a new plan",
    },
    {
        name: "customer.subscription.deleted",
        description: "Occurs whenever a customer's subscription ends",
    },
    {
        name: "customer.subscription.updated",
        description: "Occurs whenever a subscription changes (e.g., switching from one plan to another, or changing the status from trial to active)",
    },
    {
        name: "customer.updated",
        description: "Occurs whenever any property of a customer changes",
    },
    {
        name: "invoice.created",
        description: "Occurs whenever a new invoice is created",
    },
    {
        name: "invoice.finalized",
        description: "Occurs whenever a draft invoice is finalized and updated to be an open invoice",
    },
    {
        name: "invoice.payment_failed",
        description: "Occurs whenever an invoice payment attempt fails, due either to a declined payment or to the lack of a stored payment method",
    },
    {
        name: "invoice.payment_succeeded",
        description: "Occurs whenever an invoice payment attempt succeeds",
    },
    {
        name: "invoice.updated",
        description: "Occurs whenever an invoice changes (e.g., the invoice amount)",
    },
    {
        name: "issuing_authorization.request",
        description: "Represents a synchronous request for authorization",
    },
    {
        name: "issuing_card.created",
        description: "Occurs whenever a card is created",
    },
    {
        name: "issuing_cardholder.created",
        description: "Occurs whenever a cardholder is created",
    },
    {
        name: "payment_intent.amount_capturable_updated",
        description: "Occurs when a PaymentIntent has funds to be captured",
    },
    {
        name: "payment_intent.canceled",
        description: "Occurs when a PaymentIntent is canceled",
    },
    {
        name: "payment_intent.created",
        description: "Occurs when a new PaymentIntent is created",
    },
    {
        name: "payment_intent.payment_failed",
        description: "Occurs when a PaymentIntent has failed the attempt to create a payment method or a payment",
    },
    {
        name: "payment_intent.succeeded",
        description: "Occurs when a PaymentIntent has successfully completed payment",
    },
    {
        name: "payment_method.attached",
        description: "Occurs whenever a new payment method is attached to a customer",
    },
    {
        name: "setup_intent.canceled",
        description: "Occurs when a SetupIntent is canceled",
    },
    {
        name: "setup_intent.created",
        description: "Occurs when a new SetupIntent is created",
    },
    {
        name: "setup_intent.setup_failed",
        description: "Occurs when a SetupIntent has failed the attempt to setup a payment method",
    },
    {
        name: "setup_intent.succeeded",
        description: "Occurs when an SetupIntent has successfully setup a payment method",
    }
];
const globalOptions: OptionSpec[] = [
    {
        name: "--api-key",
        description: "Sets your API key to use for the command",
        args: {
            name: "stripe api key"
        }
    },
    {
        name: "--color",
        description: "Enables or disables color output",
        args: {
            name: "setting"
        }
    },
    {
        name: "--config",
        description: "Sets your config file",
        args: {
            name: "config filepath"
        }
    },
    {
        name: "--device-name",
        description: "Runs command on behlaf of another device",
        args: {
            name: "name"
        }
    },
    {
        name: ["-h", "--help"],
        description: "Provides the help documentation for commands, flags, and arguments"
    },
    {
        name: "--log-level",
        description: "Set the level of detail for log messages",
        args: {
            name: "level"
        }
    },
    {
        name: ["-v", "--version"],
        description: "Prints the version of the Stripe CLI"
    }
];
const sharedOptions: OptionSpec[] = [
    {
        name: ["-s", "--show-headers"],
        description: "Shows response HTTP headers"
    },
    {
        name: ["-c", "--confirm"],
        description: "Skips the warning prompt and automatically confirms the command being entered"
    },
    {
        name: "--dark-style",
        description: "Uses a darker color scheme"
    },
    {
        name: ["-d", "--data"],
        description: "Additional data to send with an API request",
        args: {
            name: "value"
        }
    },
    {
        name: ["-e", "--expand"],
        description: "Response attributes to expand inline",
        args: {
            name: "value"
        }
    },
    {
        name: ["-i", "--idempotency"],
        description: "Sets an idempotency key for the request, preventing the same request from replaying within 24 hours",
        args: {
            name: "key"
        }
    },
    {
        name: "--live",
        description: "Makes a live request"
    },
    {
        name: "--stripe-account",
        description: "Specify the Stripe account to use for this request",
        args: {
            name: "account id"
        }
    },
    {
        name: ["-v", "--stripe-version"],
        description: "Specify the Stripe API version to use for this request",
        args: {
            name: "version"
        }
    }
];
const completionSpec: CommandSpec = {
    name: "stripe",
    description: "CLI interface for Stripe.com",
    subcommands: [
        {
            name: "login",
            description: "Connects to your Stripe account",
            args: {
                name: "tool | tool@version"
            },
            options: [
                {
                    name: ["-i", "--interactive"],
                    description: "Manually provide an API key if you can't access a browser"
                },
                ...globalOptions
            ]
        },
        {
            name: "config",
            description: "Installs a tool in your toolchain",
            options: [
                {
                    name: ["-e", "--edit"],
                    description: "Opens the configuration file in your default editor"
                },
                {
                    name: "--list",
                    description: "List all configured options"
                },
                {
                    name: "--set",
                    description: "Set a value for the specified configuration option",
                    args: [
                        {
                            name: "option",
                            description: "Config option"
                        },
                        {
                            name: "value",
                            description: "Value for config option"
                        }
                    ]
                },
                {
                    name: "--unset",
                    description: "Remove a key-value pair from the config file",
                    args: {
                        name: "option",
                        description: "Config option"
                    }
                },
                ...globalOptions
            ]
        },
        {
            name: "completion",
            description: "Generates shell autocompletions",
            options: [
                {
                    name: "--shell",
                    description: "Opens the configuration file in your default editor",
                    args: {
                        name: "platform",
                        description: "The shell to generate completion commands for"
                    }
                },
                ...globalOptions
            ]
        },
        {
            name: "logs tail",
            description: "Logs from your Stripe requests",
            options: [
                {
                    name: "--filter-account",
                    description: "Filters request logs by the source and destination account",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-http-method",
                    description: "Filters request logs by HTTP method",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-ip-address",
                    description: "Filters request logs by IP address",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-request-path",
                    description: "Filters request logs that directly match any Stripe path",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-request-status",
                    description: "Filters request logs by the response status",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-source",
                    description: "Filters request logs by the source of each request",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-status-code",
                    description: "Filters request logs by HTTP status code",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--filter-status-code-type",
                    description: "Filters request logs by the type of HTTP status code",
                    args: {
                        name: "values"
                    }
                },
                {
                    name: "--format",
                    description: "Specify the output format for request logs",
                    args: {
                        name: "value"
                    }
                },
                ...globalOptions
            ]
        },
        {
            name: "status",
            description: "Displays Stripe's system status and service availability",
            options: [
                {
                    name: "--format",
                    description: "Formats used to display status",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "--hide-spinner",
                    description: "Hides the loading spinner when polling"
                },
                {
                    name: "--poll",
                    description: "Keeps polling for status updates"
                },
                {
                    name: "--poll-rate",
                    description: "The number of seconds (min 5) to wait between status updates",
                    args: {
                        name: "seconds",
                        description: "Min: 5, default: 60"
                    }
                },
                {
                    name: "--verbose",
                    description: "Shows the status of all Stripe systems"
                },
                ...globalOptions
            ]
        },
        {
            name: "open",
            description: "Displays Stripe's system status and service availability",
            args: {
                name: "shortcut"
            },
            options: [
                {
                    name: "--list",
                    description: "Lists all supported shortcuts"
                },
                {
                    name: "--live",
                    description: "Opens the Dashboard for your live integrations"
                },
                ...globalOptions
            ]
        },
        {
            name: "listen",
            description: "Receives webhook events from Stripe locally",
            options: [
                {
                    name: "--connect-headers",
                    description: "A comma-separated list of custom HTTP headers to any connected accounts",
                    args: {
                        name: "values",
                        description: "Key1:Value1, Key2:Value2"
                    }
                },
                {
                    name: ["-e", "--events"],
                    description: "A comma-separated list of which events to listen for",
                    args: {
                        name: "events types"
                    }
                },
                {
                    name: ["-c", "--forward-connect-to"],
                    description: "The URL that Connect webhook events will be forwarded to",
                    args: {
                        name: "url"
                    }
                },
                {
                    name: ["-f", "--forward-to"],
                    description: "The URL that webhook events will be forwarded to",
                    args: {
                        name: "url"
                    }
                },
                {
                    name: ["-H", "--headers"],
                    description: "A comma-separated list of custom HTTP headers to forward",
                    args: {
                        name: "values",
                        description: "Key1:Value1, Key2:Value2"
                    }
                },
                {
                    name: ["-l", "--latest"],
                    description: "Receive events used in the latest API version"
                },
                {
                    name: "--live",
                    description: "Make a live request"
                },
                {
                    name: ["-a", "--load-from-webhooks-api"],
                    description: "Listen for all webhook events based on existing webhook endpoints"
                },
                {
                    name: ["-j", "--print-json"],
                    description: "Print JSON objects to stdout"
                },
                {
                    name: "--skip-verify",
                    description: "Skip certificate verification when forwarding to HTTPS endpoints"
                },
                ...globalOptions
            ]
        },
        {
            name: "trigger",
            description: "Triggers webhook events to conduct local testing",
            args: {
                name: "event",
                description: "Webhook events"
            },
            options: [
                {
                    name: "--stripe-account",
                    description: "Sets a header identifying the connected account"
                },
                ...globalOptions
            ]
        },
        {
            name: "events resend",
            description: "Resend an event to test a webhook endpoint",
            args: {
                name: "event id",
                description: "The ID of the event to resend"
            },
            options: [
                {
                    name: "--account",
                    description: "Resend the event to the given Stripe account",
                    args: {
                        name: "account id"
                    }
                },
                {
                    name: "--param",
                    description: "Key-value data to send along with the API request",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "-webhook-endpoint",
                    description: "Resends the event to the given webhook endpoint ID",
                    args: {
                        name: "endpoint id"
                    }
                },
                ...sharedOptions,
                ...globalOptions
            ]
        },
        {
            name: "get",
            description: "Makes GET HTTP requests to retrieve an individual API object",
            args: {
                name: "id or path",
                description: "ID or URL path of the API object to retrieve"
            },
            options: [
                {
                    name: ["-b", "--ending-before"],
                    description: "Retrieves the previous page in the list",
                    args: {
                        name: "object id"
                    }
                },
                {
                    name: ["-l", "--limit"],
                    description: "Number of objects to return",
                    args: {
                        name: "number",
                        description: "Number between 1 - 100 (default)"
                    }
                },
                {
                    name: ["-a", "--starting-after"],
                    description: "Retrieves the next page in the list",
                    args: {
                        name: "object id"
                    }
                },
                ...sharedOptions,
                ...globalOptions
            ]
        },
        {
            name: "post",
            description: "Makes POST HTTP requests to the Stripe API",
            args: {
                name: "path",
                description: "URL path of the API object to create or update"
            },
            options: [...sharedOptions, ...globalOptions]
        },
        {
            name: "delete",
            description: "Makes DELETE HTTP requests to the Stripe API",
            args: {
                name: "path",
                description: "URL path of the API object to delete"
            },
            options: [...sharedOptions, ...globalOptions]
        },
        {
            name: "samples",
            description: "Creates a local copy of a sample",
            subcommands: [
                {
                    name: "create",
                    args: [
                        {
                            name: "sample",
                            description: "Name of the sample used to create a local copy"
                        },
                        {
                            name: "path",
                            description: "Destination path for the created sample"
                        }
                    ],
                    options: [
                        {
                            name: "--force-refresh",
                            description: "Force a refresh of the chaced list of Stripe Samples"
                        },
                        ...globalOptions
                    ]
                },
                {
                    name: "list",
                    description: "Lists available Stripe Samples",
                    options: [
                        {
                            name: "--force-refresh",
                            description: "Force a refresh of the chaced list of Stripe Samples"
                        },
                        ...globalOptions
                    ]
                }
            ],
            options: [...globalOptions]
        },
        {
            name: "serve",
            description: "Starts an HTTP server to serve static files",
            args: {
                name: "base path",
                description: "Path of the directory to serve files from"
            },
            options: [
                {
                    name: "--port",
                    description: "Port the HTTP server should use",
                    args: {
                        name: "port number"
                    }
                },
                ...globalOptions
            ]
        },
        {
            name: "terminal quickstart",
            description: "Starts up Stripe Terminal",
            options: [
                {
                    name: "--api-key",
                    args: {
                        name: "api key"
                    }
                }
            ]
        },
        {
            name: "logout",
            description: "Removes all credentials",
            options: [
                {
                    name: ["-a", "--all"],
                    description: "Removes credentials for all projects listed in your config"
                },
                ...globalOptions
            ]
        },
        {
            name: "feedback",
            description: "Prints info about how to provide feedback",
            options: [...globalOptions]
        },
        {
            name: "help",
            description: "Gets help for any command",
            args: {
                name: "command"
            }
        },
        {
            name: "version",
            description: "Gets the version and checks or updates",
            args: {
                name: "command"
            }
        }
    ],
    options: [...globalOptions]
};
export default completionSpec;
