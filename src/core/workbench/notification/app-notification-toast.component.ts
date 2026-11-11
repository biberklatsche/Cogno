// Shape and glyph animations are ported from Ding
// (https://github.com/YusufCeng1z/ding), MIT, Copyright (c) 2026 Yusuf Cengiz.
// The license text is in `DING-LICENSE` next to this file.
import { ChangeDetectionStrategy, Component, computed, Signal } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NOTIFICATION_GLYPH_PATHS } from "@cogno/shared/ui";
import { AppNotificationChannelService } from "./+state/app-notification-channel.service";
import { AppNotificationToast } from "./+state/app-notification-toast.models";
import { ToastMotionDirective } from "./toast-motion.directive";

/**
 * A notification that takes the pill over puts its buttons where those of the
 * previous one were. For this long they ignore clicks, so a click meant for
 * the previous notification does not hit the new one.
 */
const TAKEOVER_CLICK_GUARD_MS = 500;

@Component({
  selector: "app-notification-toast",
  standalone: true,
  imports: [ToastMotionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
        <section class="viewport" aria-live="polite">
            @for (toast of appNotificationToasts(); track toast.pillId) {
                <article
                    class="pill"
                    appToastMotion
                    [phase]="toast.phase"
                    [type]="toast.type"
                    [attr.data-phase]="toast.phase"
                    [attr.data-type]="toast.type">
                    <div class="icon">
                        <!-- Keyed by type: a status change rebuilds the glyph, so it is drawn again. -->
                        @for (type of [toast.type]; track type) {
                            <div class="badge">
                                <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
                                    @for (path of glyphPaths[type]; track $index) {
                                        <!-- pathLength 1 lets CSS draw the stroke. -->
                                        <path [attr.d]="path" pathLength="1"></path>
                                    }
                                </svg>
                            </div>
                        }
                    </div>
                    <div class="body">
                        <!-- Keyed by notification: the text of one that takes the pill over rolls in. -->
                        @for (notification of [toast]; track notification.id) {
                            <div class="copy" [class.took-over]="notification.id !== notification.pillId">
                                <header class="title">{{ notification.header }}</header>
                                @if (notification.body) {
                                    <p class="description">{{ notification.body }}</p>
                                }
                            </div>
                            @if (notification.target) {
                                <button
                                    class="action"
                                    type="button"
                                    [attr.tabindex]="notification.phase === 'open' ? 0 : -1"
                                    (click)="openTarget(notification)">
                                    Open tab
                                </button>
                            }
                            <button
                                class="close"
                                type="button"
                                aria-label="Dismiss notification"
                                [attr.tabindex]="notification.phase === 'open' ? 0 : -1"
                                (click)="dismiss(notification)">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M6 6l12 12M18 6L6 18"></path>
                                </svg>
                            </button>
                        }
                    </div>
                </article>
            }
        </section>
    `,
  styles: [
    `
        .viewport {
            /* The measures of the toast. ToastMotionDirective reads them from here. */
            /* Side of the closed shape. */
            --toast-size: 44px;
            /* How far below its resting place the shape starts, and how small. */
            --toast-enter-offset: 80px;
            --toast-enter-scale: 0.5;
            --toast-edge: 12px;
            position: fixed;
            right: var(--toast-edge);
            bottom: var(--toast-edge);
            z-index: 20;
        }

        .pill {
            --status: var(--foreground-color);
            /* How far text and buttons are revealed; driven by ToastMotionDirective. */
            --reveal: 0;
            --action-reveal: 0;
            /* The marks inside the ring wait for the ring to be drawn. */
            --mark-delay: 0.55s;
            position: relative;
            box-sizing: border-box;
            width: var(--toast-size);
            height: var(--toast-size);
            border-radius: 4px;
            overflow: hidden;
            color: var(--foreground-color);
            background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
            box-shadow:
                0 0 0 1px color-mix(in srgb, var(--foreground-color) 12%, transparent),
                0 4px 12px -4px color-mix(in srgb, var(--color-black) 45%, transparent);
            /* Start of the entrance, until the first frame of the motion. */
            translate: 0 var(--toast-enter-offset);
            scale: var(--toast-enter-scale);
            opacity: 0;
            will-change: translate, scale;
        }

        .pill[data-settled] {
            will-change: auto;
        }

        .pill[data-ready] {
            --mark-delay: 0.05s;
        }

        .pill[data-phase="exit"] {
            animation: toast-out 0.15s ease-out both;
        }

        .pill[data-type="success"] {
            --status: var(--color-green);
        }

        .pill[data-type="error"] {
            --status: var(--color-red);
        }

        .pill[data-type="warning"] {
            --status: var(--color-yellow);
        }

        .pill[data-type="info"] {
            --status: var(--color-blue);
        }

        .icon {
            position: absolute;
            left: 0;
            top: 0;
            width: var(--toast-size);
            height: var(--toast-size);
            display: grid;
            place-items: center;
        }

        .badge {
            position: relative;
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
        }

        .glyph {
            width: 22px;
            height: 22px;
            fill: none;
            stroke: var(--status);
            stroke-width: 2.2;
            stroke-linecap: round;
            stroke-linejoin: round;
            animation: toast-swap var(--toast-swap-duration) var(--toast-swap) 0.1s both;
        }

        .glyph path {
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
            transform-box: fill-box;
            transform-origin: center;
            animation: toast-draw 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards;
        }

        .glyph path:nth-child(n + 2) {
            animation-duration: 0.32s;
            animation-delay: var(--mark-delay);
        }

        .glyph path:nth-child(3) {
            animation-delay: calc(var(--mark-delay) + 0.08s);
        }

        /* Each status has its own little gesture, built from the parts of its glyph. */
        .pill[data-type="success"] .glyph {
            animation:
                toast-swap var(--toast-swap-duration) var(--toast-swap) 0.1s both,
                toast-pulse 0.45s var(--toast-pop) calc(var(--mark-delay) + 0.25s);
        }

        .pill[data-type="success"] .badge::after {
            content: "";
            position: absolute;
            inset: 1px;
            border-radius: 50%;
            border: 1.5px solid var(--status);
            opacity: 0;
            animation: toast-ripple 0.7s cubic-bezier(0.2, 0, 0, 1) calc(var(--mark-delay) + 0.25s);
        }

        .pill[data-type="error"] .glyph {
            animation:
                toast-swap var(--toast-swap-duration) var(--toast-swap) 0.1s both,
                toast-shake 0.42s cubic-bezier(0.3, 0, 0.3, 1) calc(var(--mark-delay) + 0.3s);
        }

        .pill[data-type="warning"] .glyph path:nth-child(2) {
            stroke-dasharray: none;
            stroke-dashoffset: 0;
            animation: toast-drop 0.5s var(--toast-pop) var(--mark-delay) both;
        }

        .pill[data-type="warning"] .glyph path:nth-child(3) {
            stroke-dasharray: none;
            stroke-dashoffset: 0;
            animation: toast-dot 0.38s var(--toast-pop) calc(var(--mark-delay) + 0.16s) both;
        }

        .pill[data-type="info"] .glyph path:nth-child(3) {
            stroke-dasharray: none;
            stroke-dashoffset: 0;
            animation: toast-dot 0.4s var(--toast-pop) var(--mark-delay) both;
        }

        .pill[data-type="info"] .glyph path:nth-child(2) {
            animation-delay: calc(var(--mark-delay) + 0.16s);
        }

        .body {
            position: absolute;
            left: var(--toast-size);
            top: 0;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0 8px;
            width: max-content;
            max-width: calc(100vw - 2 * var(--toast-edge) - var(--toast-size));
            min-height: var(--toast-size);
            padding-right: 8px;
            box-sizing: border-box;
            opacity: calc(var(--reveal) * 1.5 - 0.25);
            filter: blur(calc((1 - var(--reveal)) * 10px));
            transform: translateX(calc((1 - var(--reveal)) * -12px));
        }

        .pill[data-settled] .body {
            filter: none;
            transform: none;
        }

        .body[data-wrapped] {
            padding-bottom: 10px;
        }

        .body[data-wrapped] .copy {
            flex-basis: 100%;
            max-width: none;
        }

        .body[data-wrapped] .copy + * {
            margin-left: auto;
        }

        .copy {
            width: max-content;
            max-width: min(340px, calc(100vw - 176px));
            padding: 12px 6px 12px 0;
            line-height: 1.4;
            text-wrap: pretty;
            overflow-wrap: anywhere;
        }

        .copy.took-over {
            animation: toast-in-up 0.38s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .title {
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }

        .description {
            margin: 3px 0 0;
            font-size: 0.93em;
            opacity: 0.65;
            white-space: pre-wrap;
        }

        .pill[data-phase="open"] .description {
            animation: toast-in-up var(--toast-pop-duration) var(--toast-pop) 0.1s both;
        }

        .pill[data-phase="open"] .action,
        .pill[data-phase="open"] .close {
            animation: toast-in-button var(--toast-pop-duration) var(--toast-pop) 0.16s backwards;
        }

        .action,
        .close {
            position: relative;
            flex: none;
            margin: 0;
            border: 0;
            color: inherit;
            font: inherit;
            cursor: pointer;
            background: transparent;
            opacity: calc(var(--action-reveal) * 1.3 - 0.15);
            transform: scale(calc(0.85 + var(--action-reveal) * 0.15));
            transition:
                background-color 0.15s ease-out,
                scale 0.15s ease-out;
        }

        .action {
            height: 30px;
            padding: 0 14px;
            border-radius: 4px;
            font-size: 0.93em;
            font-weight: 600;
            background: var(--foreground-color);
            color: var(--background-color);
        }

        .close {
            width: 30px;
            height: 30px;
            padding: 0;
            border-radius: 4px;
            display: grid;
            place-items: center;
        }

        .close svg {
            width: 12px;
            height: 12px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2.4;
            stroke-linecap: round;
        }

        .action:hover {
            background: color-mix(in srgb, var(--foreground-color) 82%, var(--background-color));
        }

        .close:hover {
            background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
        }

        .action:active,
        .close:active {
            scale: 0.96;
        }

        .action:focus-visible,
        .close:focus-visible {
            outline: 2px solid var(--foreground-color);
            outline-offset: 2px;
        }

        @keyframes toast-out {
            to {
                transform: translateY(12px) scale(0.92);
                opacity: 0;
                filter: blur(4px);
            }
        }

        @keyframes toast-swap {
            from {
                opacity: 0;
                scale: 0.25;
                filter: blur(4px);
            }
        }

        @keyframes toast-in-button {
            from {
                opacity: 0;
                translate: 0 8px;
                filter: blur(4px);
            }
        }

        @keyframes toast-in-up {
            from {
                opacity: 0;
                transform: translateY(12px);
                filter: blur(4px);
            }
        }

        @keyframes toast-draw {
            to {
                stroke-dashoffset: 0;
            }
        }

        @keyframes toast-pulse {
            40% {
                transform: scale(1.14);
            }
        }

        @keyframes toast-ripple {
            from {
                opacity: 0.55;
                transform: scale(1);
            }
            to {
                opacity: 0;
                transform: scale(1.9);
            }
        }

        @keyframes toast-shake {
            20% {
                translate: -2.5px 0;
            }
            45% {
                translate: 2.5px 0;
            }
            70% {
                translate: -1.5px 0;
            }
            to {
                translate: 0;
            }
        }

        @keyframes toast-drop {
            from {
                opacity: 0;
                translate: 0 -5px;
            }
        }

        @keyframes toast-dot {
            from {
                opacity: 0;
                scale: 0;
            }
        }

        @keyframes toast-fade {
            from {
                opacity: 0;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .pill {
                translate: none !important;
                scale: none !important;
                animation: toast-fade 0.2s ease-out both;
            }

            .pill[data-phase="exit"],
            .body {
                filter: none !important;
                transform: none !important;
            }

            .glyph,
            .copy,
            .description,
            .action,
            .close,
            .badge::after {
                animation: none !important;
            }

            .glyph path {
                animation: none !important;
                stroke-dashoffset: 0 !important;
            }
        }
    `,
  ],
})
export class AppNotificationToastComponent {
  /** The toast on screen, as a list, so the template can key the pill by its id. */
  readonly appNotificationToasts: Signal<readonly AppNotificationToast[]>;
  readonly glyphPaths = NOTIFICATION_GLYPH_PATHS;

  constructor(
    private readonly appNotificationChannelService: AppNotificationChannelService,
    private readonly appBus: AppBus,
  ) {
    this.appNotificationToasts = computed(() => {
      const toast = this.appNotificationChannelService.appNotificationToast();
      return toast ? [toast] : [];
    });
  }

  dismiss(toast: AppNotificationToast): void {
    if (this.hasJustTakenOver(toast)) {
      return;
    }
    this.appNotificationChannelService.dismissAppNotificationToast();
  }

  openTarget(toast: AppNotificationToast): void {
    if (!toast.target || this.hasJustTakenOver(toast)) {
      return;
    }

    this.appBus.publish({
      type: "OpenNotificationTarget",
      payload: toast.target,
    });
    this.appNotificationChannelService.dismissAppNotificationToast();
  }

  private hasJustTakenOver(toast: AppNotificationToast): boolean {
    return toast.id !== toast.pillId && Date.now() - toast.shownAt < TAKEOVER_CLICK_GUARD_MS;
  }
}
