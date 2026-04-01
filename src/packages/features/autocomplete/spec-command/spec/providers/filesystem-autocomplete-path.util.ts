import { ShellContextContract } from "@cogno/core-api";

export class FilesystemAutocompletePathUtil {
    private static readonly PARENT_TRAVERSAL_PREFIX_RE = /^(?:\.\.\/){2,}/;
    private static readonly POSIX_AUTOCOMPLETE_ESCAPE_RE = /([\\\s"'$`!*?|&;<>(){}\[\]])/g;
    private static readonly POWERSHELL_AUTOCOMPLETE_ESCAPE_RE = /([`\s"'$])/g;

    static isParentTraversalOnly(path: string): boolean {
        if (!path) return false;
        if (path === ".") return true;
        const segments = path.split("/").filter(Boolean);
        return segments.length > 0 && segments.every(segment => segment === "..");
    }

    static shortenParentTraversalDisplay(path: string, shellContext: ShellContextContract): string {
        if (!path) return path;
        const separator = shellContext.shellType === "PowerShell" ? "\\" : "/";
        return path.replace(this.PARENT_TRAVERSAL_PREFIX_RE, `...${separator}`);
    }

    static escapePathForAutocompleteInsert(path: string, shellContext: ShellContextContract): string {
        if (!path) return path;
        if (shellContext.shellType === "PowerShell") {
            return path.replace(this.POWERSHELL_AUTOCOMPLETE_ESCAPE_RE, "`$1");
        }
        return path.replace(this.POSIX_AUTOCOMPLETE_ESCAPE_RE, "\\$1");
    }

    static unescapeAutocompletePathFragment(pathFragment: string, shellContext: ShellContextContract): string {
        if (!pathFragment) return pathFragment;
        if (shellContext.shellType === "PowerShell") {
            return pathFragment.replace(/`(.)/g, "$1");
        }
        return pathFragment.replace(/\\(.)/g, "$1");
    }
}



