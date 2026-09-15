// @generated seed by scripts (step K1); hand-edit going forward. The single
// source of truth for default settings + non-core (feature) default keybinds.
// Values are raw config strings (ConfigMapper types/transforms them at load).

export const defaultSettings = {
  enable_watch_config: "true",
  font: {
    enable_ligatures: "false",
    family: "monospace",
    size: "14",
    weight: "normal",
    weight_bold: "bold",
    custom_glyphs: "true",
    draw_bold_text_in_bright_colors: "false",
    rescale_overlapping_glyphs: "false",
    app: {
      size: "14",
      family: "sans-serif",
    },
  },
  color: {
    background: "0e1925",
    foreground: "ffffff",
    black: "32465c",
    blue: "34bbfe",
    cyan: "32d8c1",
    green: "11d894",
    magenta: "e465d9",
    red: "fd1155",
    white: "eeeeee",
    yellow: "fede55",
    bright_black: "32465c",
    bright_blue: "34bbfe",
    bright_cyan: "32d8c1",
    bright_green: "11d894",
    bright_magenta: "e465d9",
    bright_red: "fd1155",
    bright_white: "eeeeee",
    bright_yellow: "fede55",
    highlight: "34bbfe",
  },
  scrollbar: {
    overview_ruler_border_color: "0e192500",
    slider_color: "32465c66",
    slider_hover_color: "32465c",
    slider_active_color: "32465c",
    width: "6",
    sensitivity: "1",
    scroll_on_user_input: "true",
    smooth_scroll_duration: "0",
    scrollback_lines: "100000",
    fast_scroll_sensitivity: "2",
  },
  cursor: {
    color: "34bbfecc",
    accent_color: "34bbfe66",
    blink: "true",
    style: "bar",
    inactive_style: "outline",
    width: "4",
    alt_click_moves_cursor: "true",
  },
  padding: {
    remove_on_full_screen_app: "false",
    left: "0.5",
    right: "0.5",
    top: "0",
    bottom: "0.5",
  },
  background_image: {
    path: "",
    opacity: "80",
    blur: "0",
  },
  menu: {
    opacity: "80",
  },
  selection: {
    clear_on_copy: "false",
    background_color: "34bbfecc",
    inactive_background_color: "34bbfe66",
    right_click_selects_word: "false",
  },
  prompt: {
    active: "default",
    profile: {
      default: {
        order: "[dir,error_code,ok_code,duration]",
      },
    },
    segment: {
      user: {
        field: "user",
        padding_left: "5",
        foreground: "black",
        background: "yellow",
        bold: "false",
        margin_left: "-5",
      },
      emoji: {
        text: "🎲",
        size: "10",
      },
      at: {
        text: "@",
        foreground: "black",
        background: "green",
      },
      dir: {
        field: "directory",
        foreground: "black",
        background: "blue",
        padding_left: "5",
        padding_right: "5",
        radius_right: "5",
      },
      machine: {
        field: "machine",
        foreground: "black",
        background: "green",
        padding_right: "5",
        radius_right: "5",
      },
      duration: {
        field: "duration",
        foreground: "black",
        margin_left: "5",
        format: "timespan",
      },
      error_code: {
        text: "!",
        radius_left: "5",
        radius_right: "5",
        margin_left: "5",
        when: "returnCode!=0",
        padding_right: "2",
        padding_left: "2",
      },
      ok_code: {
        text: "✓",
        radius_left: "5",
        radius_right: "5",
        margin_left: "5",
        when: "returnCode==0",
        padding_right: "2",
        padding_left: "2",
      },
    },
  },
  terminal: {
    webgl: "true",
    inactive_overlay_opacity: "30",
    ignore_bracketed_paste_mode: "false",
    minimum_contrast_ratio: "4",
    screen_reader_mode: "false",
    allow_transparency: "true",
    tab_stop_width: "8",
    word_separator: '"()[]{}\'\\"\\\\,;:/&<>*+=$^!~` "',
    progress_bar: {
      enabled: "true",
    },
    notifications: {
      unread_badge: "true",
      osc9: {
        enabled: "true",
      },
      long_running_command: {
        enabled: "false",
        minimum_duration_seconds: "10",
      },
    },
    history: {
      max_entries: "0",
      ignore_commands_with_leading_space: "false",
      import_shell_history: "false",
      auto_execute: "false",
    },
    restore: {
      enabled: "true",
      scrollback: "true",
      max_lines: "1000",
    },
    decoration: {
      color: {
        background: "2f8fda55",
        border: "2f8fda",
        overview_ruler: "2f8fda",
      },
      active_color: {
        background: "f5e66399",
        border: "f5e663",
        overview_ruler: "f5e663",
      },
    },
  },
  autocomplete: {
    provider: {
      timeout_ms: "160",
    },
  },
  notification: {
    channel: {
      app: {
        available: "true",
        enabled: "true",
        duration_seconds: "5",
      },
      os: {
        available: "true",
        enabled: "false",
      },
    },
    exception: {
      handled: {
        enabled: "false",
      },
      unhandled: {
        enabled: "false",
      },
    },
  },
  feature: {
    workspace: {
      mode: "on",
      order: "10",
    },
    notification_overview: {
      mode: "on",
      order: "20",
      overview: {
        max_items: "30",
      },
    },
    command_palette: {
      mode: "on",
      order: "30",
    },
    search: {
      mode: "on",
      order: "40",
    },
    git: {
      mode: "off",
      order: "50",
    },
    process_info: {
      mode: "on",
      order: "80",
    },
    coding_agents: {
      mode: "on",
      order: "65",
      notifications: {
        working: {
          enabled: "false",
        },
        question: {
          enabled: "false",
        },
        ready: {
          enabled: "false",
        },
        error: {
          enabled: "false",
        },
      },
    },
  },
  clipboard: {
    read: "allow",
    write: "allow",
    trim_trailing_spaces: "true",
    image_paste_ttl_seconds: "60",
  },
  http_server: {
    enabled: "true",
    port: "9000",
    auto_next_port: "true",
  },
} as const;

/** Per-OS setting overrides (linux/macos); windows is the base above. */
export const platformSettingOverrides = {
  linux: {
    terminal: {
      webgl: "false",
    },
  },
  macos: {},
} as const;

/** Default keybinds for feature actions (core keybinds come from the catalog). */
export const featureKeybinds = [
  {
    action: "open_workspace",
    combo: "Ctrl+Alt+W",
    always: true,
    performable: false,
    macos: "Command+Control+W",
  },
  {
    action: "open_notification",
    combo: "Ctrl+Alt+N",
    always: true,
    performable: false,
    macos: "Command+Control+N",
  },
  {
    action: "open_command_palette",
    combo: "Ctrl+P",
    always: true,
    performable: false,
    macos: "Command+P",
  },
  {
    action: "open_terminal_search",
    combo: "Ctrl+F",
    always: true,
    performable: false,
    macos: "Command+F",
  },
  {
    action: "open_git",
    combo: "Ctrl+Alt+G",
    always: true,
    performable: false,
    macos: "Command+Control+G",
  },
  {
    action: "open_coding_agents",
    combo: "Ctrl+Alt+R",
    always: true,
    performable: false,
    macos: "Command+Control+R",
  },
] as const;
