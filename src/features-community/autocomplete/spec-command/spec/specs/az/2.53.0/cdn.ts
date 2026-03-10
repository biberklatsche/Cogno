import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "cdn",
    description: "Manage Azure Content Delivery Networks (CDNs)",
    subcommands: [
        {
            name: "custom-domain",
            description: "Manage Azure CDN Custom Domains to provide custom host names for endpoints",
            subcommands: [
                {
                    name: "create",
                    description: "Create a new custom domain to provide a hostname for a CDN endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the endpoint under the profile which is unique globally",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--hostname",
                            description: "The host name of the custom domain. Must be a domain name",
                            args: { name: "hostname" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Resource name of the custom domain",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: ["--location", "-l"],
                            description: "Location. Values from: az account list-locations. You can configure the default location using az configure --defaults location=<location>",
                            args: { name: "location" }
                        },
                        {
                            name: "--tags",
                            description: 'Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags',
                            args: { name: "tags" }
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete the custom domain of a CDN",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the endpoint under the profile which is unique globally",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Resource name of the custom domain",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "disable-https",
                    description: "Disable https delivery of the custom domain",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the endpoint under the profile which is unique globally",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Resource name of the custom domain",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "enable-https",
                    description: 'Enable HTTPS for a custom domain. The resource name of the custom domain could be obtained using "az cdn custom-domain list"',
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the parent endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Resource name of the custom domain",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the parent profile",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--min-tls-version",
                            description: "The minimum TLS version required for the custom domain",
                            args: {
                                name: "min-tls-version"
                            }
                        },
                        {
                            name: "--user-cert-group-name",
                            description: "The resource group of the KeyVault certificate",
                            args: { name: "user-cert-group-name" }
                        },
                        {
                            name: "--user-cert-protocol-type",
                            description: "The protocol type of the certificate",
                            args: {
                                name: "user-cert-protocol-type"
                            }
                        },
                        {
                            name: "--user-cert-secret-name",
                            description: "The secret name of the KeyVault certificate",
                            args: { name: "user-cert-secret-name" }
                        },
                        {
                            name: "--user-cert-secret-version",
                            description: 'The secret version of the KeyVault certificate, If not specified, the "Latest" version will always been used and the deployed certificate will be automatically rotated to the latest version when a newer version of the certificate is available',
                            args: { name: "user-cert-secret-version" }
                        },
                        {
                            name: "--user-cert-subscription-id",
                            description: "The subscription id of the KeyVault certificate",
                            args: { name: "user-cert-subscription-id" }
                        },
                        {
                            name: "--user-cert-vault-name",
                            description: "The vault name of the KeyVault certificate",
                            args: { name: "user-cert-vault-name" }
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Lists all of the existing custom domains within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the endpoint under the profile which is unique globally",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "show",
                    description: "Show details for the custom domain of a CDN",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the endpoint under the profile which is unique globally",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Resource name of the custom domain",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                }
            ]
        },
        {
            name: "edge-node",
            description: "View all available CDN edge nodes",
            subcommands: [
                {
                    name: "list",
                    description: "Edgenodes are the global Point of Presence (POP) locations used to deliver CDN content to end users"
                }
            ]
        },
        {
            name: "endpoint",
            description: "Manage CDN endpoints",
            subcommands: [
                {
                    name: "create",
                    description: "Create a named endpoint to connect to a CDN",
                    options: [
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--origin",
                            description: "Endpoint origin specified by the following space-delimited 6 tuple: www.example.com http_port https_port private_link_resource_id private_link_location private_link_approval_message. The HTTP and HTTPS ports and the private link resource ID and location are optional. The HTTP and HTTPS ports default to 80 and 443, respectively. Private link fields are only valid for the sku Standard_Microsoft, and private_link_location is required if private_link_resource_id is set",
                            args: { name: "origin" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--content-types-to-compress",
                            description: "List of content types on which compression applies. The value should be a valid MIME type",
                            args: { name: "content-types-to-compress" }
                        },
                        {
                            name: "--enable-compression",
                            description: "If compression is enabled, content will be served as compressed if user requests for a compressed version. Content won't be compressed on CDN when requested content is smaller than 1 byte or larger than 1 MB",
                            args: {
                                name: "enable-compression"
                            }
                        },
                        {
                            name: ["--location", "-l"],
                            description: "Location. Values from: az account list-locations. You can configure the default location using az configure --defaults location=<location>",
                            args: { name: "location" }
                        },
                        {
                            name: "--no-http",
                            description: "Indicates whether HTTP traffic is not allowed on the endpoint. Default is to allow HTTP traffic",
                            args: { name: "no-http" }
                        },
                        {
                            name: "--no-https",
                            description: "Indicates whether HTTPS traffic is not allowed on the endpoint. Default is to allow HTTPS traffic",
                            args: { name: "no-https" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--origin-host-header",
                            description: "The Host header to send for requests to this origin. If you leave this blank, the request hostname determines this value. Azure CDN origins, such as Web Apps, Blob Storage, and Cloud Services require this host header value to match the origin hostname by default",
                            args: { name: "origin-host-header" }
                        },
                        {
                            name: "--origin-path",
                            description: "A directory path on the origin that Azure CDN can use to retrieve content from",
                            args: { name: "origin-path" }
                        },
                        {
                            name: "--query-string-caching",
                            description: "Defines how CDN caches requests that include query strings. You can ignore any query strings when caching, bypass caching to prevent requests that contain query strings from being cached, or cache every request with a unique URL",
                            args: {
                                name: "query-string-caching"
                            }
                        },
                        {
                            name: "--tags",
                            description: 'Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags',
                            args: { name: "tags" }
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete a CDN endpoint",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "list",
                    description: "List available endpoints for a CDN",
                    options: [
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "load",
                    description: "Pre-load content for a CDN endpoint",
                    options: [
                        {
                            name: "--content-paths",
                            description: "Space-separated values. The path to the content to be loaded. Path should be a relative file URL of the origin",
                            args: { name: "content-paths" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "purge",
                    description: "Purge pre-loaded content for a CDN endpoint",
                    options: [
                        {
                            name: "--content-paths",
                            description: "Space-separated values. The path to the content to be purged. Can describe a file path or a wildcard directory",
                            args: { name: "content-paths" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "show",
                    description: "Gets an existing CDN endpoint with the specified endpoint name under the specified subscription, resource group and profile",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "start",
                    description: "Start a CDN endpoint",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "stop",
                    description: "Stop a CDN endpoint",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "update",
                    description: "Update a CDN endpoint to manage how content is delivered",
                    options: [
                        {
                            name: "--add",
                            description: "Add an object to a list of objects by specifying a path and key value pairs. Example: --add property.listProperty <key=value, string or JSON string>",
                            args: { name: "add" }
                        },
                        {
                            name: "--content-types-to-compress",
                            description: "List of content types on which compression applies. The value should be a valid MIME type",
                            args: { name: "content-types-to-compress" }
                        },
                        {
                            name: "--default-origin-group",
                            description: "The origin group to use for origins not explicitly included in an origin group. Can be specified as a resource ID or the name of an origin group of this endpoint",
                            args: { name: "default-origin-group" }
                        },
                        {
                            name: "--enable-compression",
                            description: "If compression is enabled, content will be served as compressed if user requests for a compressed version. Content won't be compressed on CDN when requested content is smaller than 1 byte or larger than 1 MB",
                            args: {
                                name: "enable-compression"
                            }
                        },
                        {
                            name: "--force-string",
                            description: "When using 'set' or 'add', preserve string literals instead of attempting to convert to JSON"
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--no-http",
                            description: "Indicates whether HTTP traffic is not allowed on the endpoint. Default is to allow HTTP traffic",
                            args: { name: "no-http" }
                        },
                        {
                            name: "--no-https",
                            description: "Indicates whether HTTPS traffic is not allowed on the endpoint. Default is to allow HTTPS traffic",
                            args: { name: "no-https" }
                        },
                        {
                            name: "--no-wait",
                            description: "Do not wait for the long-running operation to finish"
                        },
                        {
                            name: "--origin-host-header",
                            description: "The Host header to send for requests to this origin. If you leave this blank, the request hostname determines this value. Azure CDN origins, such as Web Apps, Blob Storage, and Cloud Services require this host header value to match the origin hostname by default",
                            args: { name: "origin-host-header" }
                        },
                        {
                            name: "--origin-path",
                            description: "A directory path on the origin that Azure CDN can use to retrieve content from",
                            args: { name: "origin-path" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: "--query-string-caching",
                            description: "Defines how CDN caches requests that include query strings. You can ignore any query strings when caching, bypass caching to prevent requests that contain query strings from being cached, or cache every request with a unique URL",
                            args: {
                                name: "query-string-caching"
                            }
                        },
                        {
                            name: "--remove",
                            description: "Remove a property or an element from a list. Example: --remove property.list OR --remove propertyToRemove",
                            args: { name: "remove" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--set",
                            description: "Update an object by specifying a property path and value to set. Example: --set property1.property2=",
                            args: { name: "set" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        },
                        {
                            name: "--tags",
                            description: 'Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags',
                            args: { name: "tags" }
                        }
                    ]
                },
                {
                    name: "validate-custom-domain",
                    description: "Validates the custom domain mapping to ensure it maps to the correct CDN endpoint in DNS",
                    options: [
                        {
                            name: "--host-name",
                            description: "The host name of the custom domain. Must be a domain name",
                            args: { name: "host-name" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN endpoint",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "rule",
                    description: "Manage delivery rules for an endpoint",
                    subcommands: [
                        {
                            name: "add",
                            description: "Add a delivery rule to a CDN endpoint",
                            options: [
                                {
                                    name: "--action-name",
                                    description: "The name of the action for the delivery rule: https://docs.microsoft.com/en-us/azure/cdn/cdn-standard-rules-engine-actions",
                                    args: {
                                        name: "action-name"
                                    }
                                },
                                {
                                    name: "--order",
                                    description: "The order in which the rules are applied for the endpoint. Possible values {0,1,2,3,………}. A rule with a lower order will be applied before one with a higher order. Rule with order 0 is a special rule. It does not require any condition and actions listed in it will always be applied",
                                    args: { name: "order" }
                                },
                                {
                                    name: "--cache-behavior",
                                    description: "Caching behavior for the requests",
                                    args: {
                                        name: "cache-behavior"
                                    }
                                },
                                {
                                    name: "--cache-duration",
                                    description: "The duration for which the content needs to be cached. Allowed format is [d.]hh:mm:ss",
                                    args: { name: "cache-duration" }
                                },
                                {
                                    name: "--custom-fragment",
                                    description: "Fragment to add to the redirect URL",
                                    args: { name: "custom-fragment" }
                                },
                                {
                                    name: "--custom-hostname",
                                    description: "Host to redirect. Leave empty to use the incoming host as the destination host",
                                    args: { name: "custom-hostname" }
                                },
                                {
                                    name: "--custom-path",
                                    description: "The full path to redirect. Path cannot be empty and must start with /. Leave empty to use the incoming path as destination path",
                                    args: { name: "custom-path" }
                                },
                                {
                                    name: "--custom-querystring",
                                    description: "The set of query strings to be placed in the redirect URL. leave empty to preserve the incoming query string",
                                    args: { name: "custom-querystring" }
                                },
                                {
                                    name: "--destination",
                                    description: "The destination path to be used in the rewrite",
                                    args: { name: "destination" }
                                },
                                {
                                    name: "--header-action",
                                    description: "Header action for the requests",
                                    args: {
                                        name: "header-action"
                                    }
                                },
                                {
                                    name: "--header-name",
                                    description: "Name of the header to modify",
                                    args: { name: "header-name" }
                                },
                                {
                                    name: "--header-value",
                                    description: "Value of the header",
                                    args: { name: "header-value" }
                                },
                                {
                                    name: "--ids",
                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                    args: { name: "ids" }
                                },
                                {
                                    name: "--match-values",
                                    description: 'Match values of the match condition. e.g, space separated values "GET" "HTTP"',
                                    args: { name: "match-values" }
                                },
                                {
                                    name: "--match-variable",
                                    description: "Name of the match condition: https://docs.microsoft.com/en-us/azure/cdn/cdn-standard-rules-engine-match-conditions",
                                    args: {
                                        name: "match-variable"
                                    }
                                },
                                {
                                    name: ["--name", "-n"],
                                    description: "Name of the CDN endpoint",
                                    args: { name: "name" }
                                },
                                {
                                    name: "--negate-condition",
                                    description: "If true, negates the condition",
                                    args: {
                                        name: "negate-condition"
                                    }
                                },
                                {
                                    name: "--operator",
                                    description: "Operator of the match condition",
                                    args: { name: "operator" }
                                },
                                {
                                    name: "--origin-group",
                                    description: "Name or ID of the OriginGroup that would override the default OriginGroup",
                                    args: { name: "origin-group" }
                                },
                                {
                                    name: "--preserve-unmatched-path",
                                    description: "If True, the remaining path after the source pattern will be appended to the new destination path",
                                    args: {
                                        name: "preserve-unmatched-path"
                                    }
                                },
                                {
                                    name: "--profile-name",
                                    description: "Name of the CDN profile which is unique within the resource group",
                                    args: { name: "profile-name" }
                                },
                                {
                                    name: "--query-parameters",
                                    description: "Query parameters to include or exclude (comma separated)",
                                    args: { name: "query-parameters" }
                                },
                                {
                                    name: "--query-string-behavior",
                                    description: "Query string behavior for the requests",
                                    args: {
                                        name: "query-string-behavior"
                                    }
                                },
                                {
                                    name: "--redirect-protocol",
                                    description: "Protocol to use for the redirect",
                                    args: {
                                        name: "redirect-protocol"
                                    }
                                },
                                {
                                    name: "--redirect-type",
                                    description: "The redirect type the rule will use when redirecting traffic",
                                    args: {
                                        name: "redirect-type"
                                    }
                                },
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                },
                                {
                                    name: "--rule-name",
                                    description: "Name of the rule, only required for Microsoft SKU",
                                    args: { name: "rule-name" }
                                },
                                {
                                    name: "--selector",
                                    description: "Selector of the match condition",
                                    args: { name: "selector" }
                                },
                                {
                                    name: "--source-pattern",
                                    description: "A request URI pattern that identifies the type of requests that may be rewritten",
                                    args: { name: "source-pattern" }
                                },
                                {
                                    name: "--subscription",
                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                    args: { name: "subscription" }
                                },
                                {
                                    name: "--transform",
                                    description: "Transform to apply before matching",
                                    args: {
                                        name: "transform"
                                    }
                                }
                            ]
                        },
                        {
                            name: "remove",
                            description: "Remove a delivery rule from an endpoint",
                            options: [
                                {
                                    name: "--ids",
                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                    args: { name: "ids" }
                                },
                                {
                                    name: ["--name", "-n"],
                                    description: "Name of the CDN endpoint",
                                    args: { name: "name" }
                                },
                                {
                                    name: "--order",
                                    description: "The order in which the rules are applied for the endpoint. Possible values {0,1,2,3,………}. A rule with a lower order will be applied before one with a higher order. Rule with order 0 is a special rule. It does not require any condition and actions listed in it will always be applied",
                                    args: { name: "order" }
                                },
                                {
                                    name: "--profile-name",
                                    description: "Name of the CDN profile which is unique within the resource group",
                                    args: { name: "profile-name" }
                                },
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                },
                                {
                                    name: "--rule-name",
                                    description: "Name of the rule",
                                    args: { name: "rule-name" }
                                },
                                {
                                    name: "--subscription",
                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                    args: { name: "subscription" }
                                }
                            ]
                        },
                        {
                            name: "show",
                            description: "Show delivery rules associate with the endpoint",
                            options: [
                                {
                                    name: "--ids",
                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                    args: { name: "ids" }
                                },
                                {
                                    name: ["--name", "-n"],
                                    description: "Name of the CDN endpoint",
                                    args: { name: "name" }
                                },
                                {
                                    name: "--profile-name",
                                    description: "Name of the CDN profile which is unique within the resource group",
                                    args: { name: "profile-name" }
                                },
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                },
                                {
                                    name: "--subscription",
                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                    args: { name: "subscription" }
                                }
                            ]
                        },
                        {
                            name: "action",
                            description: "Manage delivery rule actions for an endpoint",
                            subcommands: [
                                {
                                    name: "add",
                                    description: "Add an action to a delivery rule",
                                    options: [
                                        {
                                            name: "--action-name",
                                            description: "The name of the action for the delivery rule: https://docs.microsoft.com/en-us/azure/cdn/cdn-standard-rules-engine-actions",
                                            args: {
                                                name: "action-name"
                                            }
                                        },
                                        {
                                            name: "--rule-name",
                                            description: "Name of the rule",
                                            args: { name: "rule-name" }
                                        },
                                        {
                                            name: "--cache-behavior",
                                            description: "Caching behavior for the requests",
                                            args: {
                                                name: "cache-behavior"
                                            }
                                        },
                                        {
                                            name: "--cache-duration",
                                            description: "The duration for which the content needs to be cached. Allowed format is [d.]hh:mm:ss",
                                            args: { name: "cache-duration" }
                                        },
                                        {
                                            name: "--custom-fragment",
                                            description: "Fragment to add to the redirect URL",
                                            args: { name: "custom-fragment" }
                                        },
                                        {
                                            name: "--custom-hostname",
                                            description: "Host to redirect. Leave empty to use the incoming host as the destination host",
                                            args: { name: "custom-hostname" }
                                        },
                                        {
                                            name: "--custom-path",
                                            description: "The full path to redirect. Path cannot be empty and must start with /. Leave empty to use the incoming path as destination path",
                                            args: { name: "custom-path" }
                                        },
                                        {
                                            name: "--custom-querystring",
                                            description: "The set of query strings to be placed in the redirect URL. leave empty to preserve the incoming query string",
                                            args: { name: "custom-querystring" }
                                        },
                                        {
                                            name: "--destination",
                                            description: "The destination path to be used in the rewrite",
                                            args: { name: "destination" }
                                        },
                                        {
                                            name: "--header-action",
                                            description: "Header action for the requests",
                                            args: {
                                                name: "header-action"
                                            }
                                        },
                                        {
                                            name: "--header-name",
                                            description: "Name of the header to modify",
                                            args: { name: "header-name" }
                                        },
                                        {
                                            name: "--header-value",
                                            description: "Value of the header",
                                            args: { name: "header-value" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "Name of the CDN endpoint",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--origin-group",
                                            description: "Name or ID of the OriginGroup that would override the default OriginGroup",
                                            args: { name: "origin-group" }
                                        },
                                        {
                                            name: "--preserve-unmatched-path",
                                            description: "If True, the remaining path after the source pattern will be appended to the new destination path",
                                            args: {
                                                name: "preserve-unmatched-path"
                                            }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: "--query-parameters",
                                            description: "Query parameters to include or exclude (comma separated)",
                                            args: { name: "query-parameters" }
                                        },
                                        {
                                            name: "--query-string-behavior",
                                            description: "Query string behavior for the requests",
                                            args: {
                                                name: "query-string-behavior"
                                            }
                                        },
                                        {
                                            name: "--redirect-protocol",
                                            description: "Protocol to use for the redirect",
                                            args: {
                                                name: "redirect-protocol"
                                            }
                                        },
                                        {
                                            name: "--redirect-type",
                                            description: "The redirect type the rule will use when redirecting traffic",
                                            args: {
                                                name: "redirect-type"
                                            }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--source-pattern",
                                            description: "A request URI pattern that identifies the type of requests that may be rewritten",
                                            args: { name: "source-pattern" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "remove",
                                    description: "Remove an action from a delivery rule",
                                    options: [
                                        {
                                            name: "--index",
                                            description: "The index of the condition/action",
                                            args: { name: "index" }
                                        },
                                        {
                                            name: "--rule-name",
                                            description: "Name of the rule",
                                            args: { name: "rule-name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "Name of the CDN endpoint",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "show",
                                    description: "Show delivery rules asscociate with the endpoint",
                                    options: [
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "Name of the CDN endpoint",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            name: "condition",
                            description: "Manage delivery rule conditions for an endpoint",
                            subcommands: [
                                {
                                    name: "add",
                                    description: "Add a condition to a delivery rule",
                                    options: [
                                        {
                                            name: "--match-variable",
                                            description: "Name of the match condition: https://docs.microsoft.com/en-us/azure/cdn/cdn-standard-rules-engine-match-conditions",
                                            args: {
                                                name: "match-variable"
                                            }
                                        },
                                        {
                                            name: "--operator",
                                            description: "Operator of the match condition",
                                            args: { name: "operator" }
                                        },
                                        {
                                            name: "--rule-name",
                                            description: "Name of the rule",
                                            args: { name: "rule-name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--match-values",
                                            description: 'Match values of the match condition. e.g, space separated values "GET" "HTTP"',
                                            args: { name: "match-values" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "Name of the CDN endpoint",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--negate-condition",
                                            description: "If true, negates the condition",
                                            args: {
                                                name: "negate-condition"
                                            }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--selector",
                                            description: "Selector of the match condition",
                                            args: { name: "selector" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        },
                                        {
                                            name: "--transform",
                                            description: "Transform to apply before matching",
                                            args: {
                                                name: "transform"
                                            }
                                        }
                                    ]
                                },
                                {
                                    name: "remove",
                                    description: "Remove a condition from a delivery rule",
                                    options: [
                                        {
                                            name: "--index",
                                            description: "The index of the condition/action",
                                            args: { name: "index" }
                                        },
                                        {
                                            name: "--rule-name",
                                            description: "Name of the rule",
                                            args: { name: "rule-name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "Name of the CDN endpoint",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "show",
                                    description: "Show delivery rules associate with the endpoint",
                                    options: [
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "Name of the CDN endpoint",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "waf",
                    description: "Manage WAF properties of a CDN endpoint",
                    subcommands: [
                        {
                            name: "policy",
                            description: "Apply a CDN WAF policy to a CDN endpoint",
                            subcommands: [
                                {
                                    name: "remove",
                                    description: "Remove a CDN WAF policy from a CDN endpoint",
                                    options: [
                                        {
                                            name: "--endpoint-name",
                                            description: "Name of the CDN endpoint",
                                            args: { name: "endpoint-name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        },
                                        {
                                            name: ["--yes", "-y"],
                                            description: "Do not prompt for confirmation"
                                        }
                                    ]
                                },
                                {
                                    name: "set",
                                    description: "Set the CDN WAF policy applied to a CDN endpoint",
                                    options: [
                                        {
                                            name: "--endpoint-name",
                                            description: "Name of the CDN endpoint",
                                            args: { name: "endpoint-name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        },
                                        {
                                            name: "--waf-policy-id",
                                            description: "The Resource ID of the CDN WAF policy to apply to this endpoint",
                                            args: { name: "waf-policy-id" }
                                        },
                                        {
                                            name: "--waf-policy-name",
                                            description: "The name of the CDN WAF policy to apply to this endpoint. Ignored if --waf-policy-id is set",
                                            args: { name: "waf-policy-name" }
                                        },
                                        {
                                            name: "--waf-policy-resource-group-name",
                                            description: "The resource group of the CDN WAF policy to apply to this endpoint. Ignored if --waf-policy-id is set",
                                            args: { name: "waf-policy-resource-group-name" }
                                        },
                                        {
                                            name: "--waf-policy-subscription-id",
                                            description: "The Resource ID of the CDN WAF policy to apply to this endpoint. ignored if --waf-policy-id is set",
                                            args: { name: "waf-policy-subscription-id" }
                                        }
                                    ]
                                },
                                {
                                    name: "show",
                                    description: "Show which CDN WAF policy is applied to a CDN endpoint",
                                    options: [
                                        {
                                            name: "--endpoint-name",
                                            description: "Name of the CDN endpoint",
                                            args: { name: "endpoint-name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--profile-name",
                                            description: "Name of the CDN profile which is unique within the resource group",
                                            args: { name: "profile-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "name-exists",
            description: "Check the availability of a resource name. This is needed for resources where name is globally unique, such as a CDN endpoint",
            options: [
                {
                    name: "--ids",
                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                    args: { name: "ids" }
                },
                {
                    name: ["--name", "-n"],
                    description: "The resource name to validate",
                    args: { name: "name" }
                },
                {
                    name: "--subscription",
                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                    args: { name: "subscription" }
                }
            ]
        },
        {
            name: "usage",
            description: "Check the quota and actual usage of the CDN profiles under the given subscription"
        },
        {
            name: "origin",
            description: "List or show existing origins related to CDN endpoints",
            subcommands: [
                {
                    name: "create",
                    description: "Create an origin",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--host-name",
                            description: "The host name where requests to the origin will be sent",
                            args: { name: "host-name" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--disabled",
                            description: "Don't use the origin for load balancing"
                        },
                        {
                            name: "--http-port",
                            description: "The port used for http requests to the origin",
                            args: { name: "http-port" }
                        },
                        {
                            name: "--https-port",
                            description: "The port used for https requests to the origin",
                            args: { name: "https-port" }
                        },
                        {
                            name: "--origin-host-header",
                            description: "The Host header to send for requests to this origin",
                            args: { name: "origin-host-header" }
                        },
                        {
                            name: "--priority",
                            description: "The load balancing priority. Higher priorities will not be used for load balancing if any lower priority origin is healthy. Must be between 1 and 5",
                            args: { name: "priority" }
                        },
                        {
                            name: ["--private-link-approval-message", "-m"],
                            description: "The message that is shown to the approver of the private link request",
                            args: { name: "private-link-approval-message" }
                        },
                        {
                            name: ["--private-link-location", "-l"],
                            description: "The location of the private link that the origin will be connected to",
                            args: { name: "private-link-location" }
                        },
                        {
                            name: ["--private-link-resource-id", "-p"],
                            description: "The resource id of the private link that the origin will be connected to",
                            args: { name: "private-link-resource-id" }
                        },
                        {
                            name: "--weight",
                            description: "The weight of the origin in given origin group for load balancing. Must be between 1 and 1000",
                            args: { name: "weight" }
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Deletes an existing origin within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        },
                        {
                            name: ["--yes", "-y"],
                            description: "Do not prompt for confirmation"
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Lists all of the existing origins within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "show",
                    description: "Gets an existing origin within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "update",
                    description: "Update an origin",
                    options: [
                        {
                            name: "--disabled",
                            description: "Don't use the origin for load balancing",
                            args: { name: "disabled" }
                        },
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--host-name",
                            description: "The host name where requests to the origin will be sent",
                            args: { name: "host-name" }
                        },
                        {
                            name: "--http-port",
                            description: "The port used for http requests to the origin",
                            args: { name: "http-port" }
                        },
                        {
                            name: "--https-port",
                            description: "The port used for https requests to the origin",
                            args: { name: "https-port" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin",
                            args: { name: "name" }
                        },
                        {
                            name: "--origin-host-header",
                            description: "The Host header to send for requests to this origin",
                            args: { name: "origin-host-header" }
                        },
                        {
                            name: "--priority",
                            description: "The load balancing priority. Higher priorities will not be used for load balancing if any lower priority origin is healthy. Must be between 1 and 5",
                            args: { name: "priority" }
                        },
                        {
                            name: ["--private-link-approval-message", "-m"],
                            description: "The message that is shown to the approver of the private link request",
                            args: { name: "private-link-approval-message" }
                        },
                        {
                            name: ["--private-link-location", "-l"],
                            description: "The location of the private link that the origin will be connected to",
                            args: { name: "private-link-location" }
                        },
                        {
                            name: ["--private-link-resource-id", "-p"],
                            description: "The resource id of the private link that the origin will be connected to",
                            args: { name: "private-link-resource-id" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        },
                        {
                            name: "--weight",
                            description: "The weight of the origin in given origin group for load balancing. Must be between 1 and 1000",
                            args: { name: "weight" }
                        }
                    ]
                }
            ]
        },
        {
            name: "origin-group",
            description: "Manage origin groups of an endpoint",
            subcommands: [
                {
                    name: "create",
                    description: "Create an origin group",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin group",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--origins",
                            description: "The origins load balanced by this origin group, as a comma-separated list of origin names or origin resource IDs",
                            args: { name: "origins" }
                        },
                        {
                            name: "--probe-interval",
                            description: "The frequency to perform health probes in seconds",
                            args: { name: "probe-interval" }
                        },
                        {
                            name: "--probe-method",
                            description: "The request method to use for health probes",
                            args: { name: "probe-method" }
                        },
                        {
                            name: "--probe-path",
                            description: "The path relative to the origin that is used to determine the health of the origin",
                            args: { name: "probe-path" }
                        },
                        {
                            name: "--probe-protocol",
                            description: "The protocol to use for health probes",
                            args: { name: "probe-protocol" }
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Deletes an existing origin group within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin group",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        },
                        {
                            name: ["--yes", "-y"],
                            description: "Do not prompt for confirmation"
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Lists all of the existing origin groups within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "show",
                    description: "Gets an existing origin group within an endpoint",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin group",
                            args: { name: "name" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "update",
                    description: "Update an origin group",
                    options: [
                        {
                            name: "--endpoint-name",
                            description: "Name of the CDN endpoint",
                            args: { name: "endpoint-name" }
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the origin group",
                            args: { name: "name" }
                        },
                        {
                            name: "--origins",
                            description: "The origins load balanced by this origin group, as a comma-separated list of origin names from the parent endpoint origin IDs",
                            args: { name: "origins" }
                        },
                        {
                            name: "--probe-interval",
                            description: "The frequency to perform health probes in seconds",
                            args: { name: "probe-interval" }
                        },
                        {
                            name: "--probe-method",
                            description: "The request method to use for health probes",
                            args: { name: "probe-method" }
                        },
                        {
                            name: "--probe-path",
                            description: "The path relative to the origin that is used to determine the health of the origin",
                            args: { name: "probe-path" }
                        },
                        {
                            name: "--probe-protocol",
                            description: "The protocol to use for health probes",
                            args: { name: "probe-protocol" }
                        },
                        {
                            name: "--profile-name",
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "profile-name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                }
            ]
        },
        {
            name: "profile",
            description: "Manage CDN profiles to define an edge network",
            subcommands: [
                {
                    name: "create",
                    description: "Create a new CDN profile",
                    options: [
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: ["--location", "-l"],
                            description: "Location. Values from: az account list-locations. You can configure the default location using az configure --defaults location=<location>",
                            args: { name: "location" }
                        },
                        {
                            name: "--sku",
                            description: "The pricing tier (defines a CDN provider, feature list and rate) of the CDN profile. Defaults to Standard_Akamai",
                            args: {
                                name: "sku"
                            }
                        },
                        {
                            name: "--tags",
                            description: 'Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags',
                            args: { name: "tags" }
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete a CDN profile",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "list",
                    description: "List CDN profiles",
                    options: [
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "show",
                    description: "Show CDN profile details",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                },
                {
                    name: "update",
                    description: "Update a CDN profile",
                    options: [
                        {
                            name: "--add",
                            description: "Add an object to a list of objects by specifying a path and key value pairs. Example: --add property.listProperty <key=value, string or JSON string>",
                            args: { name: "add" }
                        },
                        {
                            name: "--force-string",
                            description: "When using 'set' or 'add', preserve string literals instead of attempting to convert to JSON"
                        },
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "name" }
                        },
                        {
                            name: "--remove",
                            description: "Remove a property or an element from a list. Example: --remove property.list OR --remove propertyToRemove",
                            args: { name: "remove" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--set",
                            description: "Update an object by specifying a property path and value to set. Example: --set property1.property2=",
                            args: { name: "set" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        },
                        {
                            name: "--tags",
                            description: 'Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags',
                            args: { name: "tags" }
                        }
                    ]
                },
                {
                    name: "usage",
                    description: "Checks the quota and actual usage of endpoints under the given Azure Front Door Standard or Azure Front Door Premium or CDN profile",
                    options: [
                        {
                            name: "--ids",
                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                            args: { name: "ids" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the CDN profile which is unique within the resource group",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--subscription",
                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                            args: { name: "subscription" }
                        }
                    ]
                }
            ]
        },
        {
            name: "waf",
            description: "Manage CDN WAF.\n\n\t\tWAF on Azure CDN from Microsoft is currently in public preview and is provided with a preview service level agreement. Certain features may not be supported or may have constrained capabilities. See the Supplemental Terms of Use for Microsoft Azure Previews (https://azure.microsoft.com/en-us/support/legal/preview-supplemental-terms/) for details",
            subcommands: [
                {
                    name: "policy",
                    description: "Manage CDN WAF policies",
                    subcommands: [
                        {
                            name: "delete",
                            description: "Delete a CDN WAF policy",
                            options: [
                                {
                                    name: "--ids",
                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                    args: { name: "ids" }
                                },
                                {
                                    name: ["--name", "-n"],
                                    description: "The name of the CDN WAF policy",
                                    args: { name: "name" }
                                },
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                },
                                {
                                    name: "--subscription",
                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                    args: { name: "subscription" }
                                },
                                {
                                    name: ["--yes", "-y"],
                                    description: "Do not prompt for confirmation"
                                }
                            ]
                        },
                        {
                            name: "list",
                            description: "List CDN WAF policies",
                            options: [
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                }
                            ]
                        },
                        {
                            name: "set",
                            description: "Create a new CDN WAF policy",
                            options: [
                                {
                                    name: "--block-response-body",
                                    description: "The response body to send when a request is blocked, provided as a Base64 encoded string",
                                    args: { name: "block-response-body" }
                                },
                                {
                                    name: "--block-response-status-code",
                                    description: "The response status code to send when a request is blocked",
                                    args: { name: "block-response-status-code" }
                                },
                                {
                                    name: "--disabled",
                                    description: "Disable the policy",
                                    args: { name: "disabled" }
                                },
                                {
                                    name: "--ids",
                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                    args: { name: "ids" }
                                },
                                {
                                    name: "--mode",
                                    description: "The operation mode of the policy. Valid options are 'Detection' and 'Prevention'",
                                    args: { name: "mode" }
                                },
                                {
                                    name: ["--name", "-n"],
                                    description: "The name of the CDN WAF policy",
                                    args: { name: "name" }
                                },
                                {
                                    name: "--redirect-url",
                                    description: "The URL to use when redirecting a request",
                                    args: { name: "redirect-url" }
                                },
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                },
                                {
                                    name: "--sku",
                                    description: "The pricing tier (defines a CDN provider, feature list and rate) of the CDN WAF policy",
                                    args: { name: "sku" }
                                },
                                {
                                    name: "--subscription",
                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                    args: { name: "subscription" }
                                },
                                {
                                    name: "--tags",
                                    description: 'Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags',
                                    args: { name: "tags" }
                                }
                            ]
                        },
                        {
                            name: "show",
                            description: "Show details of a CDN WAF policy",
                            options: [
                                {
                                    name: "--ids",
                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                    args: { name: "ids" }
                                },
                                {
                                    name: ["--name", "-n"],
                                    description: "The name of the CDN WAF policy",
                                    args: { name: "name" }
                                },
                                {
                                    name: ["--resource-group", "-g"],
                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                    args: { name: "resource-group" }
                                },
                                {
                                    name: "--subscription",
                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                    args: { name: "subscription" }
                                }
                            ]
                        },
                        {
                            name: "custom-rule",
                            description: "Manage custom rules of a CDN WAF policy",
                            subcommands: [
                                {
                                    name: "delete",
                                    description: "Remove a custom rule from a CDN WAF policy",
                                    options: [
                                        {
                                            name: ["--name", "-n"],
                                            description: "The name of the custom rule",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        },
                                        {
                                            name: ["--yes", "-y"],
                                            description: "Do not prompt for confirmation"
                                        }
                                    ]
                                },
                                {
                                    name: "list",
                                    description: "List custom rules of a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        }
                                    ]
                                },
                                {
                                    name: "set",
                                    description: "Add a custom rule to a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--action",
                                            description: "The action to take when the rule is matched",
                                            args: {
                                                name: "action"
                                            }
                                        },
                                        {
                                            name: ["--match-condition", "-m"],
                                            description: "Conditions used to determine if the rule is matched for a request",
                                            args: { name: "match-condition" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "The name of the custom rule",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--priority",
                                            description: "The priority of the custom rule as a non-negative integer",
                                            args: { name: "priority" }
                                        },
                                        {
                                            name: "--disabled",
                                            description: "Disable the custom rule",
                                            args: { name: "disabled" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "show",
                                    description: "Show a custom rule of a CDN WAF policy",
                                    options: [
                                        {
                                            name: ["--name", "-n"],
                                            description: "The name of the custom rule",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            name: "managed-rule-set",
                            description: "Manage managed rule sets of a CDN WAF policy",
                            subcommands: [
                                {
                                    name: "add",
                                    description: "Add a managed rule set to a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--rule-set-type",
                                            description: "The type of the managed rule set",
                                            args: { name: "rule-set-type" }
                                        },
                                        {
                                            name: "--rule-set-version",
                                            description: "The version of the managed rule set",
                                            args: { name: "rule-set-version" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "list",
                                    description: "List managed rule sets added to a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        }
                                    ]
                                },
                                {
                                    name: "list-available",
                                    description: "List available CDN WAF managed rule sets"
                                },
                                {
                                    name: "remove",
                                    description: "Remove a managed rule set from a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--rule-set-type",
                                            description: "The type of the managed rule set",
                                            args: { name: "rule-set-type" }
                                        },
                                        {
                                            name: "--rule-set-version",
                                            description: "The version of the managed rule set",
                                            args: { name: "rule-set-version" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        },
                                        {
                                            name: ["--yes", "-y"],
                                            description: "Do not prompt for confirmation"
                                        }
                                    ]
                                },
                                {
                                    name: "show",
                                    description: "Show a managed rule of a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--rule-set-type",
                                            description: "The type of the managed rule set",
                                            args: { name: "rule-set-type" }
                                        },
                                        {
                                            name: "--rule-set-version",
                                            description: "The version of the managed rule set",
                                            args: { name: "rule-set-version" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "rule-group-override",
                                    description: "Manage rule group overrides of a managed rule on a CDN WAF policy",
                                    subcommands: [
                                        {
                                            name: "delete",
                                            description: "Remove a rule group override from a managed rule set on a CDN WAF policy",
                                            options: [
                                                {
                                                    name: ["--name", "-n"],
                                                    description: "The name of the rule group",
                                                    args: { name: "name" }
                                                },
                                                {
                                                    name: "--rule-set-type",
                                                    description: "The type of the managed rule set",
                                                    args: { name: "rule-set-type" }
                                                },
                                                {
                                                    name: "--rule-set-version",
                                                    description: "The version of the managed rule set",
                                                    args: { name: "rule-set-version" }
                                                },
                                                {
                                                    name: "--ids",
                                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                                    args: { name: "ids" }
                                                },
                                                {
                                                    name: "--policy-name",
                                                    description: "Name of the CDN WAF policy",
                                                    args: { name: "policy-name" }
                                                },
                                                {
                                                    name: ["--resource-group", "-g"],
                                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                                    args: { name: "resource-group" }
                                                },
                                                {
                                                    name: "--subscription",
                                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                                    args: { name: "subscription" }
                                                },
                                                {
                                                    name: ["--yes", "-y"],
                                                    description: "Do not prompt for confirmation"
                                                }
                                            ]
                                        },
                                        {
                                            name: "list",
                                            description: "List rule group overrides of a managed rule on a CDN WAF policy",
                                            options: [
                                                {
                                                    name: "--policy-name",
                                                    description: "Name of the CDN WAF policy",
                                                    args: { name: "policy-name" }
                                                },
                                                {
                                                    name: ["--resource-group", "-g"],
                                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                                    args: { name: "resource-group" }
                                                },
                                                {
                                                    name: "--rule-set-type",
                                                    description: "The type of the managed rule set",
                                                    args: { name: "rule-set-type" }
                                                },
                                                {
                                                    name: "--rule-set-version",
                                                    description: "The version of the managed rule set",
                                                    args: { name: "rule-set-version" }
                                                }
                                            ]
                                        },
                                        {
                                            name: "list-available",
                                            description: "List available CDN WAF managed rule groups of a managed rule set",
                                            options: [
                                                {
                                                    name: "--rule-set-type",
                                                    description: "The type of the managed rule set",
                                                    args: { name: "rule-set-type" }
                                                },
                                                {
                                                    name: "--rule-set-version",
                                                    description: "The version of the managed rule set",
                                                    args: { name: "rule-set-version" }
                                                }
                                            ]
                                        },
                                        {
                                            name: "set",
                                            description: "Add or update a rule group override to a managed rule set on a CDN WAF policy",
                                            options: [
                                                {
                                                    name: ["--name", "-n"],
                                                    description: "The name of the rule group",
                                                    args: { name: "name" }
                                                },
                                                {
                                                    name: ["--rule-override", "-r"],
                                                    description: "Override a rule in the rule group",
                                                    args: { name: "rule-override" }
                                                },
                                                {
                                                    name: "--rule-set-type",
                                                    description: "The type of the managed rule set",
                                                    args: { name: "rule-set-type" }
                                                },
                                                {
                                                    name: "--rule-set-version",
                                                    description: "The version of the managed rule set",
                                                    args: { name: "rule-set-version" }
                                                },
                                                {
                                                    name: "--ids",
                                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                                    args: { name: "ids" }
                                                },
                                                {
                                                    name: "--policy-name",
                                                    description: "Name of the CDN WAF policy",
                                                    args: { name: "policy-name" }
                                                },
                                                {
                                                    name: ["--resource-group", "-g"],
                                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                                    args: { name: "resource-group" }
                                                },
                                                {
                                                    name: "--subscription",
                                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                                    args: { name: "subscription" }
                                                }
                                            ]
                                        },
                                        {
                                            name: "show",
                                            description: "Show a rule group override of a managed rule on a CDN WAF policy",
                                            options: [
                                                {
                                                    name: ["--name", "-n"],
                                                    description: "The name of the rule group",
                                                    args: { name: "name" }
                                                },
                                                {
                                                    name: "--rule-set-type",
                                                    description: "The type of the managed rule set",
                                                    args: { name: "rule-set-type" }
                                                },
                                                {
                                                    name: "--rule-set-version",
                                                    description: "The version of the managed rule set",
                                                    args: { name: "rule-set-version" }
                                                },
                                                {
                                                    name: "--ids",
                                                    description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                                    args: { name: "ids" }
                                                },
                                                {
                                                    name: "--policy-name",
                                                    description: "Name of the CDN WAF policy",
                                                    args: { name: "policy-name" }
                                                },
                                                {
                                                    name: ["--resource-group", "-g"],
                                                    description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                                    args: { name: "resource-group" }
                                                },
                                                {
                                                    name: "--subscription",
                                                    description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                                    args: { name: "subscription" }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            name: "rate-limit-rule",
                            description: "Manage rate limit rules of a CDN WAF policy",
                            subcommands: [
                                {
                                    name: "delete",
                                    description: "Remove a rate limit rule from a CDN WAF policy",
                                    options: [
                                        {
                                            name: ["--name", "-n"],
                                            description: "The name of the rate limit rule",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        },
                                        {
                                            name: ["--yes", "-y"],
                                            description: "Do not prompt for confirmation"
                                        }
                                    ]
                                },
                                {
                                    name: "list",
                                    description: "List rate limit rules of a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        }
                                    ]
                                },
                                {
                                    name: "set",
                                    description: "Add a rate limit rule to a CDN WAF policy",
                                    options: [
                                        {
                                            name: "--action",
                                            description: "The action to take when the rule is matched",
                                            args: {
                                                name: "action"
                                            }
                                        },
                                        {
                                            name: "--duration",
                                            description: "The duration of the rate limit in minutes. Valid values are 1 and 5",
                                            args: { name: "duration" }
                                        },
                                        {
                                            name: ["--match-condition", "-m"],
                                            description: "Conditions used to determine if the rule is matched for a request",
                                            args: { name: "match-condition" }
                                        },
                                        {
                                            name: ["--name", "-n"],
                                            description: "The name of the rate limit rule",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--priority",
                                            description: "The priority of the rate limit rule as a non-negative integer",
                                            args: { name: "priority" }
                                        },
                                        {
                                            name: "--request-threshold",
                                            description: "The request threshold to trigger rate limiting",
                                            args: { name: "request-threshold" }
                                        },
                                        {
                                            name: "--disabled",
                                            description: "Disable the rate limit rule",
                                            args: { name: "disabled" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                },
                                {
                                    name: "show",
                                    description: "Show a rate limit rule of a CDN WAF policy",
                                    options: [
                                        {
                                            name: ["--name", "-n"],
                                            description: "The name of the rate limit rule",
                                            args: { name: "name" }
                                        },
                                        {
                                            name: "--ids",
                                            description: "One or more resource IDs (space-delimited). It should be a complete resource ID containing all information of 'Resource Id' arguments. You should provide either --ids or other 'Resource Id' arguments",
                                            args: { name: "ids" }
                                        },
                                        {
                                            name: "--policy-name",
                                            description: "Name of the CDN WAF policy",
                                            args: { name: "policy-name" }
                                        },
                                        {
                                            name: ["--resource-group", "-g"],
                                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                                            args: { name: "resource-group" }
                                        },
                                        {
                                            name: "--subscription",
                                            description: "Name or ID of subscription. You can configure the default subscription using az account set -s NAME_OR_ID",
                                            args: { name: "subscription" }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};
export default completion;
