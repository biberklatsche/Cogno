// Ported from Ding (https://github.com/YusufCeng1z/ding), MIT, Copyright (c) 2026
// Yusuf Cengiz. The license text is in
// `src/core/workbench/notification/DING-LICENSE`.

const RING = "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18";

/**
 * The glyph of each notification type as stroke paths on a 24×24 grid. The
 * first path is always the ring, the others are the marks inside it.
 */
export const NOTIFICATION_GLYPH_PATHS = {
  success: [RING, "M7.9 12.4l3 3 5.3-6"],
  error: [RING, "M9.3 9.3l5.4 5.4", "M14.7 9.3l-5.4 5.4"],
  warning: [RING, "M12 7.6v5.2", "M12 16.3h.01"],
  info: [RING, "M12 11v5.2", "M12 7.8h.01"],
} as const satisfies Record<string, readonly string[]>;
