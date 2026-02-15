import { CommandSpec } from "../spec.types";
import { DOCKER_FIG_SPEC } from "./commands/docker.spec";
import { GIT_FIG_SPEC } from "./commands/git.spec";
import { KUBECTL_FIG_SPEC } from "./commands/kubectl.spec";
import { NPM_FIG_SPEC } from "./commands/npm.spec";
import { PNPM_FIG_SPEC } from "./commands/pnpm.spec";
import { YARN_FIG_SPEC } from "./commands/yarn.spec";

// Fig subset (statically imported, generators/scripts intentionally omitted).
// Source root: https://github.com/withfig/autocomplete/tree/master/src
export const FIG_SUBSET_IMPORTED_SPECS: CommandSpec[] = [
    NPM_FIG_SPEC,
    GIT_FIG_SPEC,
    DOCKER_FIG_SPEC,
    KUBECTL_FIG_SPEC,
    PNPM_FIG_SPEC,
    YARN_FIG_SPEC,
];

