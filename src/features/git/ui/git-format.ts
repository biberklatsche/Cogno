import { Icon } from "@cogno/shared/ui";
import { GitFile } from "../model/git-model";

/** A commit time as "today 14:03", "yesterday 09:12" or a short date. */
export function formatCommitTime(seconds: number, now: Date = new Date()): string {
  const date = new Date(seconds * 1000);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (date.getTime() >= startOfToday) return `today ${time}`;
  if (date.getTime() >= startOfToday - day) return `yesterday ${time}`;
  return `${date.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })} ${time}`;
}

export function fileStatusIcon(file: GitFile): Icon {
  if (file.isDirectory) return "mdiFolderOutline";
  switch (file.status) {
    case "A":
    case "?":
      return "mdiPlus";
    case "D":
      return "mdiMinus";
    case "U":
      return "mdiAlert";
    default:
      return "mdiPencil";
  }
}

export function fileStatusClass(file: GitFile): string {
  switch (file.status) {
    case "A":
    case "?":
      return "status-added";
    case "D":
      return "status-removed";
    case "U":
      return "status-conflict";
    default:
      return "status-edited";
  }
}

export function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function fileDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/** Lane colors of the graph, cycled. */
export const GRAPH_COLORS = [
  "var(--color-blue)",
  "var(--color-green)",
  "var(--color-magenta)",
  "var(--color-yellow)",
  "var(--color-cyan)",
  "var(--color-red)",
] as const;

export function graphColor(index: number): string {
  return GRAPH_COLORS[index % GRAPH_COLORS.length] ?? "var(--color-blue)";
}
