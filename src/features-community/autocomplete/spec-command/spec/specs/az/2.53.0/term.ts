import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "term",
    description: "Manage marketplace agreement with marketplaceordering",
    subcommands: [
        {
            name: "accept",
            description: "Accept marketplace terms",
            options: [
                {
                    name: "--plan",
                    description: "Plan identifier string of image being deployed",
                    args: { name: "plan" }
                },
                {
                    name: "--product",
                    description: "Offer identifier string of image being deployed",
                    args: { name: "product" }
                },
                {
                    name: "--publisher",
                    description: "Publisher identifier string of image being deployed",
                    args: { name: "publisher" }
                }
            ]
        },
        {
            name: "show",
            description: "Get marketplace terms",
            options: [
                {
                    name: "--plan",
                    description: "Plan identifier string of image being deployed",
                    args: { name: "plan" }
                },
                {
                    name: "--product",
                    description: "Offeridentifier string of image being deployed",
                    args: { name: "product" }
                },
                {
                    name: "--publisher",
                    description: "Publisher identifier string of image being deployed",
                    args: { name: "publisher" }
                }
            ]
        }
    ]
};
export default completion;
