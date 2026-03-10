import type { CommandSpec, Suggestion } from "../spec.types";
const settings: Suggestion[] = [
    {
        name: ["displaysleep", "dim"],
        description: "Display sleep timer (value in minutes, or 0 to disable)",
    },
    {
        name: ["disksleep", "spindown"],
        description: "Disk spindown timer (value in minutes, or 0 to disable)",
    },
    {
        name: "sleep",
        description: "System sleep timer (value in minutes, or 0 to disable)",
    },
    {
        name: "womp",
        description: "Wake on ethernet magic packet (value = 0/1)",
    },
    {
        name: "ring",
        description: "Wake on modem ring (value = 0/1)",
    },
    {
        name: "autorestart",
        description: "Automatic restart on power loss (value = 0/1)",
    },
    {
        name: "dps",
        description: "Dynamically change processor speed based on load (value = 0/1)",
    },
    {
        name: "reduce",
        description: "Reduce processor speed (value = 0/1)",
    },
    {
        name: "powerbutton",
        description: "Sleep the machine when power button is pressed (value=0/1)",
    },
    {
        name: "lidwake",
        description: "Wake the machine when the laptop lid (or clamshell) is opened (value = 0/1)",
    },
    {
        name: "acwake",
        description: "Wake the machine when power source (AC/battery) is changed (value = 0/1)",
    },
    {
        name: "lessbright",
        description: "Slightly turn down display brightness when switching to this power source (value = 0/1)",
    },
    {
        name: "halfdim",
        description: "Display sleep will use an intermediate half-brightness state between full brightness and fully off  (value = 0/1)",
    },
    {
        name: "sms",
        description: "Use Sudden Motion Sensor to park disk heads on sudden changes in G force (value = 0/1)",
    },
    {
        name: "hibernatemode",
        description: "Change hibernation mode. 0 = normal sleep, 1 = hibernate mode, 3 = safe sleep, 25 = hibernate mode for post-2005 portable Macs",
    },
    {
        name: "hibernatefile",
        description: "Change hibernation image file location. (value = path)",
    },
    {
        name: "ttyskeepawake",
        description: "Prevent idle system sleep when any tty (e.g. remote login session) is 'active'. (value = 0/1)",
    },
    {
        name: "networkoversleep",
        description: "This setting affects how macOS networking presents shared network services during system sleep",
    },
    {
        name: "destroyfvkeyonstandby",
        description: "Destroy File Vault Key when going to standby mode. (value: 1 - Destroy, 0 - Retain)",
    }
];
const events: string[] = [
    "sleep",
    "wake",
    "poweron",
    "shutdown",
    "wakeorpoweron"
];
const completionSpec: CommandSpec = {
    name: "pmset",
    description: "Power management settings",
    subcommands: [
        {
            name: "-g",
            description: "GETTING",
            args: [
                {
                    name: "UUID",
                    description: "Used for historydetailed"
                }
            ]
        },
        {
            name: "schedule",
            description: "For setting up one-time power events",
            options: [{ name: "cancel" }],
            args: [
                { name: "type" },
                {
                    name: "date/time",
                    description: '"MM/dd/yy HH:mm:ss" (in 24 hour format; must be in quotes)'
                }
            ]
        },
        {
            name: "repeat",
            description: "For setting up daily/weekly power on and power off events",
            subcommands: [{ name: "cancel" }],
            args: [
                { name: "type" },
                {
                    name: "weekdays",
                    description: 'A subset of MTWRFSU ("M" and "MTWRF" are valid strings)'
                },
                {
                    name: "date/time",
                    description: '"MM/dd/yy HH:mm:ss" (in 24 hour format; must be in quotes)'
                }
            ]
        }
    ],
    options: [
        {
            name: "-a",
            description: "Settings for all",
            args: [{ name: "setting" }, { name: "value" }]
        },
        {
            name: "-b",
            description: "Settings for battery",
            args: [{ name: "setting" }, { name: "value" }]
        },
        {
            name: "-c",
            description: "Settings for charger",
            args: [{ name: "setting" }, { name: "value" }]
        },
        {
            name: "-u",
            description: "Settings for UPS",
            args: [{ name: "setting" }, { name: "value" }]
        }
    ]
};
export default completionSpec;
