import { Injectable } from "@angular/core";
import { ClipboardAccess, Opener } from "@cogno/platform";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
  ContextMenuItem,
  ContextMenuOverlayService,
  DialogService,
} from "@cogno/shared/ui";
import { GitDiffSource } from "./git-diff.service";
import {
  GitOperationOutcome,
  GitOperationsService,
  GitPullMode,
  GitResetMode,
} from "./git-operations.service";
import { GitRepositoryService } from "./git-repository.service";
import { GitGraphColumn, GitViewState, GitWipFileGroup } from "./git-view-state.service";
import {
  ageReference,
  byRemote,
  keptReason,
  trackedRemoteBranches,
} from "./model/git-branch-cleanup";
import {
  GitBranch,
  GitCommit,
  GitFile,
  GitRefLabel,
  GitRemote,
  GitRemoteBranch,
  GitStash,
  GitTag,
} from "./model/git-model";
import { cloneDirectoryName } from "./model/git-parsers";
import { buildHunkPatch, GitHunk, GitPatch } from "./model/git-patch";
import {
  GitDeleteBranchesDialogComponent,
  GitDeleteBranchesDialogData,
  GitDeleteBranchesResult,
} from "./ui/git-delete-branches-dialog.component";
import { formatAge } from "./ui/git-format";
import {
  GitPromptDialogComponent,
  GitPromptDialogData,
  GitPromptResult,
} from "./ui/git-prompt-dialog.component";

const RESET_MODES: ReadonlyArray<readonly [GitResetMode, string]> = [
  ["soft", "Soft - keep all changes"],
  ["mixed", "Mixed - keep working copy but reset index"],
  ["hard", "Hard - discard all changes"],
];

/**
 * What the user can do in the panel, as the toolbar, the context menus and
 * the buttons offer it: asks for names and confirmation where needed and
 * hands the git work to `GitOperationsService`.
 */
@Injectable({ providedIn: "root" })
export class GitUiActions {
  constructor(
    private readonly repository: GitRepositoryService,
    private readonly operations: GitOperationsService,
    private readonly view: GitViewState,
    private readonly dialogs: DialogService,
    private readonly contextMenu: ContextMenuOverlayService,
    private readonly clipboard: ClipboardAccess,
    private readonly opener: Opener,
  ) {}

  // Bulk delete

  /** Ask which of the shown local branches to delete, then delete them. */
  async deleteLocalBranches(shown: ReadonlyArray<GitBranch>): Promise<void> {
    const refs = this.repository.refs();
    const head = this.repository.head();
    const reference = ageReference(refs);
    const result = await this.chooseBranches({
      message: "Delete these local branches?",
      items: shown.map((branch) => ({
        name: branch.name,
        detail: [branch.upstreamGone ? "gone" : "", formatAge(branch.lastCommitAt, reference)]
          .filter(Boolean)
          .join(" · "),
        keptReason: keptReason(branch, refs, head),
      })),
      remoteOption: "Also delete the remote branches they track",
    });
    if (!result) return;

    let remaining = await this.operations.deleteBranches(result.names, false);
    // `-d` refuses branches whose commits are nowhere else; offer to drop them together.
    if (
      remaining.length > 0 &&
      (await this.confirm(
        `${remaining.join(", ")} ${remaining.length === 1 ? "has" : "have"} commits that are not merged anywhere. Delete anyway? Those commits are lost.`,
        "Delete anyway",
      ))
    ) {
      remaining = await this.operations.deleteBranches(remaining, true);
    }
    if (!result.alsoRemote) return;

    const deleted = shown.filter(
      (branch) => result.names.includes(branch.name) && !remaining.includes(branch.name),
    );
    for (const [remote, names] of byRemote(trackedRemoteBranches(deleted, refs, head))) {
      await this.operations.deleteRemoteBranches(remote, names);
    }
  }

  /** Ask which of the shown remote branches to delete, then delete them on their remotes. */
  async deleteRemoteBranches(shown: ReadonlyArray<GitRemoteBranch>): Promise<void> {
    const refs = this.repository.refs();
    const head = this.repository.head();
    const reference = ageReference(refs);
    const result = await this.chooseBranches({
      message: "Delete these branches on the remote? They are gone for everyone who works with it.",
      items: shown.map((branch) => ({
        name: branch.name,
        detail: formatAge(branch.lastCommitAt, reference),
        keptReason: keptReason(branch, refs, head),
      })),
    });
    if (!result) return;

    const chosen = shown.filter((branch) => result.names.includes(branch.name));
    for (const [remote, names] of byRemote(chosen)) {
      await this.operations.deleteRemoteBranches(remote, names);
    }
  }

  // Toolbar

  pull(): void {
    void this.operations.pull(this.view.pullMode());
  }

  /** Choose what the Pull button does, and do it. */
  openPullMenu(event: MouseEvent): void {
    const choose = (mode: GitPullMode) => () => {
      this.view.pullMode.set(mode);
      return this.operations.pull(mode);
    };
    const options: ReadonlyArray<readonly [GitPullMode, string]> = [
      ["fetch", "Fetch All"],
      ["merge", "Pull (fast-forward if possible)"],
      ["ff-only", "Pull (fast-forward only)"],
      ["rebase", "Pull (rebase)"],
    ];
    this.openMenu(
      event,
      options.map(([mode, label]) => ({
        ...item(label, choose(mode)),
        checked: this.view.pullMode() === mode,
      })),
    );
  }

  /** Push the checked-out branch; publish it first if it has no upstream yet. */
  async pushCurrentBranch(): Promise<void> {
    const branch = this.repository.currentBranch();
    if (!branch) return;
    await this.pushBranch(branch);
  }

  /** Open the name field in the commit's graph row, as GitKraken does. */
  beginBranch(sha: string | null): void {
    if (!sha) return;
    this.view.revealCommit(sha);
    this.view.newBranchAt.set(sha);
  }

  /** Create and check out the branch named in the graph row; an empty name just closes it. */
  finishBranch(name: string): void {
    const sha = this.view.newBranchAt();
    this.view.newBranchAt.set(null);
    if (!sha || !name.trim()) return;
    void this.operations.createBranch(name.trim(), sha, true);
  }

  cancelBranch(): void {
    this.view.newBranchAt.set(null);
  }

  stash(): void {
    void this.operations.stash("");
  }

  popLatestStash(): void {
    const latest = this.repository.stashes()[0];
    if (latest) void this.operations.popStash(latest.ref);
  }

  async clone(): Promise<void> {
    const result = await this.prompt("Clone a repository", {
      message:
        "The repository is cloned into the folder below, relative to the terminal's current directory.",
      fields: [
        {
          key: "url",
          label: "URL",
          placeholder: "https://github.com/user/repo.git",
          required: true,
        },
        { key: "directory", label: "Folder" },
      ],
      confirmLabel: "Clone",
      derive: (key, values): Record<string, string> =>
        key === "url" ? { directory: cloneDirectoryName(values["url"] ?? "") } : {},
    });
    if (!result) return;
    void this.operations.clone(result.values["url"] ?? "", result.values["directory"] ?? "");
  }

  init(): void {
    void this.operations.init();
  }

  /** Column settings as GitKraken offers them on the graph header: tick what is shown. */
  openColumnMenu(event: MouseEvent): void {
    const columns: ReadonlyArray<readonly [GitGraphColumn, string]> = [
      ["refs", "Branch / Tag"],
      ["graph", "Graph"],
      ["author", "Author"],
      ["date", "Date / Time"],
      ["sha", "SHA"],
    ];
    const hidden = this.view.hiddenColumns();
    this.openMenu(event, [
      { label: "Columns", header: true },
      ...columns.map(
        ([column, label]): ContextMenuItem => ({
          label,
          toggle: true,
          toggled: !hidden.has(column),
          closeOnSelect: false,
          action: (item) => {
            this.view.hiddenColumns.update((current) => {
              const next = new Set(current);
              if (next.has(column)) next.delete(column);
              else next.add(column);
              return next;
            });
            // The menu stays open; its switch mirrors the new state.
            if (item) item.toggled = !item.toggled;
          },
        }),
      ),
    ]);
  }

  /**
   * Check out the branch a graph label stands for, as a double click does in
   * GitKraken: a remote branch through a local one tracking it. A tag or the
   * checked-out branch is left alone.
   */
  checkoutLabel(label: GitRefLabel): void {
    const refs = this.repository.refs();
    if (label.kind === "branch" && !label.isHead) {
      void this.operations.checkoutBranch(label.name);
    } else if (label.kind === "remote") {
      const remoteBranch = refs.remoteBranches.find((b) => b.name === label.name);
      if (remoteBranch) void this.operations.checkoutRemoteBranch(remoteBranch);
    }
  }

  // Context menus

  openCommitMenu(event: MouseEvent, commit: GitCommit): void {
    const head = this.repository.head();
    const current = head.branch ?? "HEAD";
    const short = commit.sha.slice(0, 7);
    const isMerge = commit.parents.length > 1;
    const localBranches = this.repository
      .refs()
      .branches.filter((branch) => branch.sha === commit.sha && branch.name !== head.branch);
    this.openMenu(event, [
      ...localBranches.map((branch) =>
        item(`Checkout ${branch.name}`, () => this.operations.checkoutBranch(branch.name)),
      ),
      item("Checkout this commit", () => this.operations.checkoutCommit(commit.sha)),
      separator(),
      item("Create branch here", () => this.beginBranch(commit.sha)),
      item("Create tag here", () => this.createTagAt(commit.sha, short)),
      separator(),
      item(
        "Cherry pick commit",
        () => this.operations.cherryPick(commit.sha, isMerge),
        commit.sha === head.sha,
      ),
      item("Revert commit", () => this.operations.revert(commit.sha, isMerge)),
      ...(head.sha && commit.sha !== head.sha ? this.resetItems(current, commit.sha) : []),
      separator(),
      item("Copy commit sha", () => this.clipboard.writeText(commit.sha)),
      item("Copy commit message", () => this.copyCommitMessage(commit.sha)),
    ]);
  }

  openBranchMenu(event: MouseEvent, branch: GitBranch): void {
    const head = this.repository.head();
    const isHead = branch.name === head.branch;
    const current = head.branch ?? "HEAD";
    const upstream = this.repository.refs().remoteBranches.find((r) => r.name === branch.upstream);
    // The tip may lie beyond the loaded commits; git then refuses a merge without `-m` itself.
    const isMerge =
      (this.repository.commits().find((commit) => commit.sha === branch.sha)?.parents.length ?? 0) >
      1;
    this.openMenu(event, [
      isHead
        ? item("Pull", () => this.operations.pull("merge"), !branch.upstream)
        : item(
            "Pull (fast-forward only)",
            () => upstream && this.operations.pullBranch(branch.name, upstream),
            !upstream,
          ),
      item(branch.upstream ? `Push ${branch.name} to ${branch.upstream}` : "Push", () =>
        this.pushBranch(branch),
      ),
      item("Set Upstream", () => this.setUpstream(branch)),
      ...(isHead
        ? []
        : [
            separator(),
            item(`Merge ${branch.name} into ${current}`, () => this.operations.merge(branch.name)),
            item(`Rebase ${current} onto ${branch.name}`, () =>
              this.operations.rebase(branch.name),
            ),
            separator(),
            item(`Checkout ${branch.name}`, () => this.operations.checkoutBranch(branch.name)),
          ]),
      separator(),
      item("Create branch here", () => this.beginBranch(branch.sha)),
      item(
        "Cherry pick commit",
        () => this.operations.cherryPick(branch.sha, isMerge),
        branch.sha === head.sha,
      ),
      ...(head.sha && branch.sha !== head.sha ? this.resetItems(current, branch.sha) : []),
      item("Revert commit", () => this.operations.revert(branch.sha, isMerge)),
      separator(),
      item("Create tag here", () => this.createTagAt(branch.name, branch.name)),
      separator(),
      item(`Rename ${branch.name}`, () => this.renameBranch(branch)),
      item(`Delete ${branch.name}`, () => this.deleteBranch(branch), isHead),
      // A remote branch of the same name on the same commit shares this label in the graph.
      ...this.repository
        .refs()
        .remoteBranches.filter((r) => r.shortName === branch.name && r.sha === branch.sha)
        .map((remoteBranch) =>
          item(`Delete ${remoteBranch.name}`, () => this.deleteRemoteBranch(remoteBranch)),
        ),
      separator(),
      item("Copy branch name", () => this.clipboard.writeText(branch.name)),
      item("Copy commit sha", () => this.clipboard.writeText(branch.sha)),
    ]);
  }

  openRemoteBranchMenu(event: MouseEvent, remoteBranch: GitRemoteBranch): void {
    const current = this.repository.head().branch ?? "HEAD";
    this.openMenu(event, [
      item(`Checkout ${remoteBranch.name}`, () =>
        this.operations.checkoutRemoteBranch(remoteBranch),
      ),
      separator(),
      item(`Merge ${remoteBranch.name} into ${current}`, () =>
        this.operations.merge(remoteBranch.name),
      ),
      item(`Rebase ${current} onto ${remoteBranch.name}`, () =>
        this.operations.rebase(remoteBranch.name),
      ),
      separator(),
      item("Create branch here", () => this.beginBranch(remoteBranch.sha)),
      item(`Delete ${remoteBranch.name}`, () => this.deleteRemoteBranch(remoteBranch)),
      separator(),
      item("Copy branch name", () => this.clipboard.writeText(remoteBranch.name)),
    ]);
  }

  openRemoteMenu(event: MouseEvent, remote: GitRemote): void {
    this.openMenu(event, [
      item(`Fetch ${remote.name}`, () => this.operations.fetch(remote.name)),
      item("Copy remote URL", () => this.clipboard.writeText(remote.url)),
      separator(),
      item(`Remove ${remote.name}`, () => this.removeRemote(remote)),
    ]);
  }

  openTagMenu(event: MouseEvent, tag: GitTag): void {
    const remotes = this.repository.remotes();
    this.openMenu(event, [
      item(`Checkout the commit at ${tag.name}`, () => this.operations.checkoutCommit(tag.name)),
      item("Create branch here", () => this.beginBranch(tag.sha)),
      separator(),
      ...remotes.map((remote) =>
        item(`Push ${tag.name} to ${remote.name}`, () =>
          this.operations.pushTag(remote.name, tag.name),
        ),
      ),
      item(`Delete ${tag.name} locally`, () =>
        this.confirmThen(`Delete tag ${tag.name}?`, "Delete", () =>
          this.operations.deleteTag(tag.name),
        ),
      ),
      ...remotes.map((remote) =>
        item(`Delete ${tag.name} from ${remote.name}`, () =>
          this.confirmThen(`Delete tag ${tag.name} from ${remote.name}?`, "Delete", () =>
            this.operations.deleteRemoteTag(remote.name, tag.name),
          ),
        ),
      ),
      separator(),
      item("Copy tag name", () => this.clipboard.writeText(tag.name)),
    ]);
  }

  openStashMenu(event: MouseEvent, stash: GitStash): void {
    this.openMenu(event, [
      item("Apply Stash", () => this.operations.applyStash(stash.ref)),
      item("Pop Stash", () => this.operations.popStash(stash.ref)),
      separator(),
      item("Delete Stash", () =>
        this.confirmThen(`Delete ${stash.ref} (${stash.message})?`, "Delete", () =>
          this.operations.dropStash(stash.ref),
        ),
      ),
    ]);
  }

  openWipFileMenu(event: MouseEvent, file: GitFile, group: GitWipFileGroup): void {
    const items: ContextMenuItem[] =
      group === "conflicted"
        ? [
            item("Take current (ours)", () => this.operations.takeConflictSide(file.path, "ours")),
            item("Take incoming (theirs)", () =>
              this.operations.takeConflictSide(file.path, "theirs"),
            ),
            item("Mark resolved", () => this.operations.markResolved(file.path)),
          ]
        : group === "staged"
          ? [item("Unstage", () => this.operations.unstage([file.path]))]
          : [
              item("Stage", () => this.operations.stage([file.path])),
              item("Discard changes", () => this.discardFile(file)),
            ];
    this.openMenu(event, [
      ...items,
      separator(),
      item("Open file", () => this.openFile(file), file.status === "D"),
      item("Copy file path", () => this.clipboard.writeText(file.path)),
    ]);
  }

  openCommitFileMenu(event: MouseEvent, file: GitFile, sha: string): void {
    this.openMenu(event, [
      item(
        "Restore file from this commit",
        () =>
          this.confirmThen(
            `Replace ${file.path} in the working tree with its version from ${sha.slice(0, 7)}?`,
            "Restore",
            () => this.operations.restoreFile(sha, file.path),
          ),
        file.status === "D",
      ),
      item("Open file", () => this.openFile(file)),
      item("Copy file path", () => this.clipboard.writeText(file.path)),
    ]);
  }

  // Hunks

  stageHunk(patch: GitPatch, hunk: GitHunk, lines: ReadonlySet<number>): void {
    const text = buildHunkPatch(patch, hunk, lines.size > 0 ? lines : undefined);
    if (text) void this.operations.applyPatch(text, { cached: true, reverse: false });
  }

  unstageHunk(patch: GitPatch, hunk: GitHunk, lines: ReadonlySet<number>): void {
    const text = buildHunkPatch(patch, hunk, lines.size > 0 ? lines : undefined);
    if (text) void this.operations.applyPatch(text, { cached: true, reverse: true });
  }

  async discardHunk(patch: GitPatch, hunk: GitHunk, lines: ReadonlySet<number>): Promise<void> {
    const text = buildHunkPatch(patch, hunk, lines.size > 0 ? lines : undefined);
    if (!text) return;
    const what = lines.size > 0 ? `these ${lines.size} lines` : "this hunk";
    await this.confirmThen(
      `Discard the changes in ${what}? They are not recoverable.`,
      "Discard",
      () => this.operations.applyPatch(text, { cached: false, reverse: true }),
    );
  }

  // Buttons

  showDiff(source: GitDiffSource): void {
    if (source.file.isDirectory) return;
    this.view.openDiff(source);
  }

  async discardFile(file: GitFile): Promise<void> {
    const untracked = file.status === "?";
    await this.confirmThen(
      untracked
        ? `Delete the untracked file ${file.path}?`
        : `Discard the changes to ${file.path}?`,
      untracked ? "Delete" : "Discard",
      () => this.operations.discard(untracked ? [] : [file.path], untracked ? [file.path] : []),
    );
  }

  async discardAllUnstaged(): Promise<void> {
    const status = this.repository.status();
    await this.confirmThen(
      "Discard all unstaged changes and delete all untracked files?",
      "Discard all",
      () =>
        this.operations.discard(
          status.unstaged.length > 0 ? ["."] : [],
          status.untracked.map((file) => file.path),
        ),
    );
  }

  openFile(file: GitFile): void {
    const root = this.repository.root();
    if (root) void this.opener.openPath(`${root}/${file.path}`);
  }

  async addRemote(): Promise<void> {
    const result = await this.prompt("Add a remote", {
      fields: [
        {
          key: "name",
          label: "Name",
          value: this.repository.remotes().length === 0 ? "origin" : "",
          required: true,
        },
        { key: "url", label: "URL", required: true },
      ],
      confirmLabel: "Add remote",
    });
    if (result)
      void this.operations.addRemote(result.values["name"] ?? "", result.values["url"] ?? "");
  }

  private async pushBranch(branch: GitBranch, force = false): Promise<void> {
    let remote: string;
    let remoteBranch: string;
    let setUpstream = false;
    const upstream = branch.upstream ? this.splitRemoteRef(branch.upstream) : null;
    if (upstream && !branch.upstreamGone) {
      [remote, remoteBranch] = upstream;
    } else {
      const remotes = this.repository.remotes();
      if (remotes.length === 0) {
        await this.addRemote();
        return;
      }
      const result = await this.prompt(`Publish ${branch.name}`, {
        message: "The branch has no upstream yet. Push it to:",
        fields: [
          {
            key: "remote",
            label: "Remote",
            value: remotes.find((r) => r.name === "origin")?.name ?? remotes[0]?.name,
            required: true,
          },
          { key: "branch", label: "Remote branch", value: branch.name, required: true },
        ],
        confirmLabel: "Push",
      });
      if (!result) return;
      remote = result.values["remote"] ?? "";
      remoteBranch = result.values["branch"] ?? "";
      setUpstream = true;
    }
    const outcome = await this.operations.push(branch.name, remote, remoteBranch, {
      setUpstream,
      force,
    });
    if (outcome === "rejected" && !force) {
      const confirmed = await this.confirm(
        `The remote has commits that ${branch.name} does not have. Force push and overwrite ${remote}/${remoteBranch}? It is only overwritten if nobody pushed since your last fetch.`,
        "Force push",
      );
      if (confirmed)
        await this.operations.push(branch.name, remote, remoteBranch, { setUpstream, force: true });
    }
  }

  private async setUpstream(branch: GitBranch): Promise<void> {
    const remote = this.repository.remotes()[0]?.name ?? "origin";
    const result = await this.prompt(`Set upstream of ${branch.name}`, {
      fields: [
        {
          key: "upstream",
          label: "Remote branch",
          value: branch.upstream ?? `${remote}/${branch.name}`,
          required: true,
        },
      ],
      confirmLabel: "Set upstream",
    });
    if (result) void this.operations.setUpstream(branch.name, result.values["upstream"] ?? "");
  }

  private async renameBranch(branch: GitBranch): Promise<void> {
    const result = await this.prompt(`Rename ${branch.name}`, {
      fields: [{ key: "name", label: "New name", value: branch.name, required: true }],
      confirmLabel: "Rename",
    });
    const name = result?.values["name"];
    if (name && name !== branch.name) void this.operations.renameBranch(branch.name, name);
  }

  private async deleteBranch(branch: GitBranch): Promise<void> {
    if (!(await this.confirm(`Delete the branch ${branch.name}?`, "Delete"))) return;
    const outcome = await this.operations.deleteBranch(branch.name, false);
    if (outcome !== "rejected") return;
    // `-d` refuses a branch whose commits are nowhere else; offer to drop them.
    const force = await this.confirm(
      `${branch.name} has commits that are not merged anywhere. Delete it anyway? Those commits are lost.`,
      "Delete anyway",
    );
    if (force) await this.operations.deleteBranch(branch.name, true);
  }

  private deleteRemoteBranch(remoteBranch: GitRemoteBranch): Promise<void> {
    return this.confirmThen(
      `Delete ${remoteBranch.shortName} on ${remoteBranch.remote}?`,
      "Delete",
      () => this.operations.deleteRemoteBranch(remoteBranch),
    );
  }

  private removeRemote(remote: GitRemote): Promise<void> {
    return this.confirmThen(`Remove the remote ${remote.name}?`, "Remove", () =>
      this.operations.removeRemote(remote.name),
    );
  }

  private async createTagAt(ref: string, label: string): Promise<void> {
    const result = await this.prompt(`Create tag at ${label}`, {
      fields: [
        { key: "name", label: "Tag name", required: true },
        { key: "message", label: "Message (makes an annotated tag)" },
      ],
      confirmLabel: "Create tag",
    });
    if (result)
      void this.operations.createTag(
        result.values["name"] ?? "",
        ref,
        result.values["message"] ?? "",
      );
  }

  private resetItems(current: string, sha: string): ContextMenuItem[] {
    return [
      { label: `Reset ${current} to this commit`, header: true },
      ...RESET_MODES.map(([mode, label]) =>
        item(label, () =>
          mode === "hard"
            ? this.confirmThen(
                `Reset ${current} to ${sha.slice(0, 7)} and discard all uncommitted changes?`,
                "Reset",
                () => this.operations.reset(sha, mode),
              )
            : this.operations.reset(sha, mode),
        ),
      ),
    ];
  }

  private async copyCommitMessage(sha: string): Promise<void> {
    const result = await this.repository.run(["log", "-1", "--format=%B", sha]);
    if (result?.exitCode === 0) await this.clipboard.writeText(result.stdout.trimEnd());
  }

  private splitRemoteRef(ref: string): [string, string] | null {
    const remote = this.repository
      .remotes()
      .map((r) => r.name)
      .sort((a, b) => b.length - a.length)
      .find((name) => ref.startsWith(`${name}/`));
    return remote ? [remote, ref.slice(remote.length + 1)] : null;
  }

  private openMenu(event: MouseEvent, items: ContextMenuItem[]): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.openAtPoint(event, { items: trimSeparators(items) });
  }

  private async confirmThen(
    message: string,
    confirmLabel: string,
    action: () => Promise<GitOperationOutcome>,
  ): Promise<void> {
    if (await this.confirm(message, confirmLabel)) await action();
  }

  private confirm(message: string, confirmLabel: string): Promise<boolean> {
    const ref = this.dialogs.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title: "Git",
      data: { message, confirmLabel, cancelLabel: "Cancel" },
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    return whenClosed(ref).then((result) => result ?? false);
  }

  private chooseBranches(
    data: GitDeleteBranchesDialogData,
  ): Promise<GitDeleteBranchesResult | undefined> {
    const ref = this.dialogs.open<GitDeleteBranchesDialogData, GitDeleteBranchesResult>(
      GitDeleteBranchesDialogComponent,
      { title: "Delete branches", data, width: "36rem", maxWidth: "calc(100vw - 2rem)" },
    );
    return whenClosed(ref);
  }

  private prompt(title: string, data: GitPromptDialogData): Promise<GitPromptResult | undefined> {
    const ref = this.dialogs.open<GitPromptDialogData, GitPromptResult>(GitPromptDialogComponent, {
      title,
      data,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });
    return whenClosed(ref);
  }
}

function item(label: string, action: () => unknown, disabled = false): ContextMenuItem {
  return { label, disabled, action: () => void action() };
}

function separator(): ContextMenuItem {
  return { separator: true };
}

/** No separator at the start or end, and never two in a row. */
function trimSeparators(items: ContextMenuItem[]): ContextMenuItem[] {
  const result: ContextMenuItem[] = [];
  for (const entry of items) {
    if (entry.separator && (result.length === 0 || result[result.length - 1]?.separator)) continue;
    result.push(entry);
  }
  while (result[result.length - 1]?.separator) result.pop();
  return result;
}

/** The result a dialog closes with; undefined when dismissed. */
function whenClosed<T>(ref: { close: (result?: T) => void }): Promise<T | undefined> {
  return new Promise((resolve) => {
    const close = ref.close.bind(ref);
    ref.close = (result?: T) => {
      resolve(result);
      close(result);
    };
  });
}
