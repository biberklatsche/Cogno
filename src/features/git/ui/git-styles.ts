/** Styles the parts of the git panel share: rows, section headers, badges, inputs. */
export const GIT_SHARED_STYLES = `
  :host {
    --git-subtle: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);
    --git-hover: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
    --git-border: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
    --git-selected: color-mix(in srgb, var(--highlight-color) var(--menu-opacity-ct2), transparent);
    /* Two sizes only: the text, and everything secondary (headers, counts, meta). */
    --git-font-small: 0.85em;
    --git-row-height: 26px;
    --git-gutter: 0.5rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: var(--git-row-height);
    padding: 0 var(--git-gutter);
    cursor: default;
    white-space: nowrap;
  }
  .row:hover { background: var(--git-hover); }
  .row.selected { background: var(--git-selected); }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-height: var(--git-row-height);
    padding: 0 var(--git-gutter);
    box-sizing: border-box;
    color: var(--git-subtle);
    font-size: var(--git-font-small);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    user-select: none;
  }
  .section-header .grow { flex: 1; }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
  }

  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .subtle { color: var(--git-subtle); }
  .small { font-size: var(--git-font-small); }
  .mono { font-family: var(--font-mono, monospace); font-size: var(--git-font-small); }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 32px;
    padding: 0 var(--git-gutter);
    border-bottom: 1px solid var(--git-border);
  }
  .panel-header .grow { flex: 1; }

  .button.small {
    padding: 0.1rem 0.5rem;
    font-size: var(--git-font-small);
    text-transform: none;
    letter-spacing: normal;
  }

  .icon-button app-icon { width: 1rem; height: 1rem; }
  .small-icon { width: 14px; height: 14px; flex: 0 0 auto; }
  .icon-button:disabled { opacity: 0.3; cursor: not-allowed; }

  .row-action {
    flex: 0 0 auto;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0.2rem;
    color: var(--git-subtle);
    visibility: hidden;
  }
  .row:hover .row-action, .row.selected .row-action { visibility: visible; }
  .row-action:hover { color: var(--foreground-color); }

  .status-edited { color: var(--color-yellow); }
  .status-added { color: var(--color-green); }
  .status-removed { color: var(--color-red); }
  .status-conflict { color: var(--color-red); }

  .text-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--background-color);
    color: var(--foreground-color);
    border: 1px solid var(--git-border);
    border-radius: var(--button-border-radius);
    padding: 0.3rem 0.5rem;
    font: inherit;
  }
  .text-input:focus { outline: none; border-color: var(--highlight-color); }

  .empty {
    padding: 1rem 0.75rem;
    color: var(--git-subtle);
    font-style: italic;
    text-align: center;
  }

  .spin { animation: git-spin 1s linear infinite; }
  @keyframes git-spin { to { transform: rotate(360deg); } }
`;
