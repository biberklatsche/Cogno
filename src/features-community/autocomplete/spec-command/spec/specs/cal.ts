import { monthSuggestions } from "./ncal";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "cal",
    description: "Displays a calendar and the date of Easter",
    options: [
        {
            name: "-h",
            description: "Turns off highlighting of today"
        },
        {
            name: "-j",
            description: "Display Julian days (days one-based, numbered from January 1)"
        },
        {
            name: "-m",
            description: "Display the specified month.  If month is specified as a decimal number, it may be followed by the letter ‘f’ or ‘p’ to indicate the following or preceding month of that number, respectively",
            args: {
                name: "month"
            }
        },
        {
            name: "-y",
            description: "Display a calendar for the specified year"
        }
    ]
};
export default completionSpec;
