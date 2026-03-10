import type { ArgSpec, CommandSpec } from "../spec.types";
enum ICONS {
    npm = "fig://icon?type=npm",
    yarn = "fig://icon?type=yarn",
    pnpm = "https://pnpm.io/img/favicon.png",
    true = "✅",
    false = "❌",
    ng = "https://angular.io/assets/images/logos/angular/angular.svg",
    nx = "https://github.com/nrwl/nx/raw/master/images/nx-logo.png",
    option = "fig://icon?type=option",
    react = "https://reactjs.org/favicon.ico",
    webComponents = "https://web-components-resources.appspot.com/static/logo.svg",
    next = "https://nextjs.org/static/favicon/favicon.ico",
    gatsby = "https://www.gatsbyjs.com/favicon-32x32.png?v=3ad5294f3fa6c06e2d07ab07c76df2cf",
    nest = "https://nestjs.com/favicon.264d6486.ico",
    express = "https://expressjs.com/images/favicon.png",
    css = "https://upload.wikimedia.org/wikipedia/commons/6/62/CSS3_logo.svg",
    scss = "https://sass-lang.com/favicon.ico",
    less = "https://lesscss.org/public/ico/favicon.ico",
    stylus = "https://stylus-lang.com/favicon.ico",
    emotion = "https://emotion.sh/favicons/favicon.ico",
    styled = "https://styled-components.com/favicon.png",
    vercel = "https://assets.vercel.com/image/upload/q_auto/front/favicon/vercel/favicon.ico"
}
const boolArg: (name: string, isOptional: boolean) => ArgSpec = (name, isOptional) => ({
    name
});
const workspaceNameArg: ArgSpec = {
    name: "workspace",
    description: "The name of the workspace"
};
const completionSpec: CommandSpec = {
    name: "create-nx-workspace",
    description: "Create a new Nx workspace",
    options: [
        {
            name: "--name",
            description: "Workspace name (e.g., org name)",
            args: workspaceNameArg
        },
        {
            name: "--preset",
            description: 'What to create in a new workspace (options: "empty", "npm", "web-components", "angular", "angular-nest", "react", "react-express", "react-native", "next", "gatsby", "nest", "express")',
            args: {
                name: "preset"
            }
        },
        {
            name: "--appName",
            description: "The name of the application created by some presets",
            args: {
                name: "appName"
            }
        },
        {
            name: "--cli",
            description: 'CLI to power the Nx workspace (options: "nx", "angular")',
            args: {
                name: "cli"
            }
        },
        {
            name: "--style",
            description: 'Default style option to be used when a non-empty preset is selected options: ("css", "scss", "less") plus ("styl") for all non-Angular and ("styled-components", "@emotion/styled", "styled-jsx") for React, Next.js, Gatsby',
            args: {
                name: "style"
            }
        },
        {
            name: "--interactive",
            description: "Enable interactive mode when using presets (boolean)",
            args: boolArg("interactive", true)
        },
        {
            name: ["--packageManager", "--pm"],
            description: "Package manager to use (npm, yarn, pnpm)",
            args: {
                name: "packageManager"
            }
        },
        {
            name: "--nx-cloud",
            description: "Use Nx Cloud (boolean)",
            args: boolArg("nx-cloud", true)
        },
        {
            name: ["--help", "-h"],
            description: "Show help for create-nx-workspace"
        }
    ]
};
export default completionSpec;
