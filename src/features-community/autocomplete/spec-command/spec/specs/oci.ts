import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "oci",
    description: "Oracle Cloud Infrastructure CLI",
    subcommands: [
        {
            name: "compute",
            description: "Manage Compute resources like instances and images",
            subcommands: [
                {
                    name: "instance",
                    description: "Manage Compute instances",
                    subcommands: [
                        {
                            name: "launch",
                            description: "Launch a new compute instance",
                            options: [
                                {
                                    name: "--availability-domain",
                                    description: "The availability domain of the instance"
                                },
                                {
                                    name: "--compartment-id",
                                    description: "The OCID of the compartment"
                                },
                                {
                                    name: "--shape",
                                    description: "The shape of the instance"
                                }
                            ]
                        },
                        {
                            name: "terminate",
                            description: "Terminate a compute instance",
                            options: [
                                {
                                    name: "--instance-id",
                                    description: "The OCID of the instance"
                                }
                            ]
                        },
                        {
                            name: "start",
                            description: "Start a stopped instance",
                            options: [
                                {
                                    name: "--instance-id",
                                    description: "The OCID of the instance"
                                }
                            ]
                        },
                        {
                            name: "stop",
                            description: "Stop a running instance",
                            options: [
                                {
                                    name: "--instance-id",
                                    description: "The OCID of the instance"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "image",
                    description: "Manage Custom Images",
                    subcommands: [
                        {
                            name: "list",
                            description: "List available compute images",
                            options: [
                                {
                                    name: "--compartment-id",
                                    description: "The OCID of the compartment"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "network",
            description: "Manage Virtual Cloud Network resources",
            subcommands: [
                {
                    name: "vcn",
                    description: "Manage Virtual Cloud Networks",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new VCN",
                            options: [
                                {
                                    name: "--compartment-id",
                                    description: "The OCID of the compartment"
                                },
                                {
                                    name: "--cidr-block",
                                    description: "The CIDR block of the VCN"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "db",
            description: "Manage Database resources",
            subcommands: [
                {
                    name: "autonomous-database",
                    description: "Manage Autonomous Databases",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create an Autonomous Database",
                            options: [
                                {
                                    name: "--compartment-id",
                                    description: "The OCID of the compartment"
                                },
                                {
                                    name: "--db-name",
                                    description: "The database name"
                                },
                                {
                                    name: "--cpu-core-count",
                                    description: "Number of CPU cores"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "os",
            description: "Object Storage commands",
            subcommands: [
                {
                    name: "bucket",
                    description: "Manage buckets",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new bucket",
                            options: [
                                {
                                    name: "--compartment-id",
                                    description: "The OCID of the compartment"
                                },
                                {
                                    name: "--name",
                                    description: "The name of the bucket"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "iam",
            description: "Manage Identity and Access Management resources",
            subcommands: [
                {
                    name: "user",
                    description: "Manage users",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new user",
                            options: [
                                {
                                    name: "--name",
                                    description: "Name of the user"
                                },
                                {
                                    name: "--description",
                                    description: "Description for the user"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "policy",
                    description: "Manage IAM policies",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new policy",
                            options: [
                                {
                                    name: "--name",
                                    description: "Name of the policy"
                                },
                                {
                                    name: "--statements",
                                    description: "Policy statements"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "group",
                    description: "Manage IAM groups",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new group",
                            options: [
                                {
                                    name: "--name",
                                    description: "The name of the group"
                                },
                                {
                                    name: "--description",
                                    description: "Description for the group"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "compartment",
                    description: "Manage compartments",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new compartment",
                            options: [
                                {
                                    name: "--name",
                                    description: "The name of the compartment"
                                },
                                {
                                    name: "--description",
                                    description: "Description for the compartment"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "kms",
            description: "Manage Key Management resources",
            subcommands: [
                {
                    name: "key",
                    description: "Manage encryption keys",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new key",
                            options: [
                                {
                                    name: "--compartment-id",
                                    description: "The OCID of the compartment"
                                },
                                {
                                    name: "--display-name",
                                    description: "Display name of the key"
                                },
                                {
                                    name: "--key-shape",
                                    description: "Shape of the key"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "monitoring",
            description: "Manage Monitoring and Alerts",
            subcommands: [
                {
                    name: "alarm",
                    description: "Manage monitoring alarms",
                    subcommands: [
                        {
                            name: "create",
                            description: "Create a new alarm",
                            options: [
                                {
                                    name: "--display-name",
                                    description: "Display name of the alarm"
                                },
                                {
                                    name: "--metric-compartment-id",
                                    description: "Compartment OCID containing the metric"
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: "budget",
            description: "Manage Budgets and Cost Controls",
            subcommands: [
                {
                    name: "create",
                    description: "Create a new budget",
                    options: [
                        {
                            name: "--compartment-id",
                            description: "The OCID of the compartment"
                        },
                        {
                            name: "--amount",
                            description: "The amount for the budget"
                        },
                        {
                            name: "--reset-period",
                            description: "The reset period for the budget"
                        }
                    ]
                }
            ]
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for oci"
        },
        {
            name: ["--profile", "-p"],
            description: "The profile to load from the config file",
            args: {
                name: "profile"
            }
        },
        {
            name: "--config-file",
            description: "The path to the config file",
            args: {
                name: "file"
            }
        },
        {
            name: "--region",
            description: "The region to make calls against"
        },
        {
            name: "--output",
            description: "The output format"
        },
        {
            name: "--debug",
            description: "Turn on debug logging"
        },
        {
            name: "--auth",
            description: "The type of auth to use"
        },
        {
            name: "--key-file",
            description: "The path to the private key file"
        },
        {
            name: "--wait-for-state",
            description: "Wait until resource reaches a given state"
        },
        {
            name: "--wait-interval-seconds",
            description: "Check interval seconds for --wait-for-state",
            args: {
                name: "seconds"
            }
        },
        {
            name: "--max-wait-seconds",
            description: "Maximum time to wait",
            args: {
                name: "seconds"
            }
        },
        {
            name: "--raw-output",
            description: "Output raw response from OCI API"
        },
        {
            name: "--output-format",
            description: "The output format for commands"
        },
        {
            name: "--query",
            description: "JMESPath query to filter the output"
        }
    ]
};
export default completionSpec;
