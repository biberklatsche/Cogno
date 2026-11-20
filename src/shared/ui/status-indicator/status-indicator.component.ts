import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  OnDestroy,
  signal,
  untracked,
} from "@angular/core";

/**
 * What a status indicator shows: the face, the head from the logo, for an agent;
 * the equalizer for a running command.
 */
export type StatusIndicator =
  | {
      readonly motif: "face";
      readonly mood: "calm" | "busy" | "asking" | "failed";
    }
  | { readonly motif: "equalizer"; readonly mood: "calm" | "busy" };

const FADE_MS = 150;

type Layer = {
  readonly id: number;
  readonly indicator: StatusIndicator;
  readonly leaving: boolean;
};

let nextMaskId = 0;

/**
 * The small animated status of a tab, a pane or an agent. A change of motif
 * cross-fades; a change of mood switches the animation in place; no indicator
 * fades out. Sized by the host, 14px unless the consumer says otherwise.
 */
@Component({
  selector: "app-status-indicator",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (layer of layers(); track layer.id) {
      @if (layer.indicator.motif === "face") {
        <svg
          viewBox="66 34 290 310"
          aria-hidden="true"
          [attr.class]="
            'layer face ' +
            layer.indicator.mood +
            (layer.leaving ? ' leaving' : '')
          "
        >
          <defs>
            <mask
              [attr.id]="maskId + '-' + layer.id"
              maskUnits="userSpaceOnUse"
              x="60"
              y="28"
              width="300"
              height="322"
            >
              <g class="tilt">
                <g class="antenna">
                  <path d="M232 104 L245 82" stroke="#fff" stroke-width="28" stroke-linecap="round" />
                  <circle class="ball" cx="252" cy="69" r="24" fill="#fff" />
                </g>
                <path
                  d="M84 226 C 76 150, 146 90, 226 94 C 308 98, 336 166, 322 238 C 308 306, 236 330, 170 322 C 112 314, 90 284, 84 226 Z"
                  fill="#fff"
                />
                <g class="eyes">
                  <circle class="eye" cx="155" cy="222" r="33" fill="#000" />
                  <circle class="eye" cx="265" cy="222" r="33" fill="#000" />
                </g>
                <path
                  class="crossed"
                  d="M131 198 L179 246 M179 198 L131 246 M241 198 L289 246 M289 198 L241 246"
                  fill="none"
                  stroke="#000"
                  stroke-width="30"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
            </mask>
          </defs>
          <rect
            x="60"
            y="28"
            width="300"
            height="322"
            fill="currentColor"
            [attr.mask]="'url(#' + maskId + '-' + layer.id + ')'"
          />
        </svg>
      } @else {
        <svg
          viewBox="0 0 14 14"
          aria-hidden="true"
          [attr.class]="
            'layer equalizer ' +
            layer.indicator.mood +
            (layer.leaving ? ' leaving' : '')
          "
        >
          <rect
            x="0"
            y="1"
            width="2"
            height="12"
            rx="0.8"
            fill="currentColor"
          />
          <rect
            x="3"
            y="1"
            width="2"
            height="12"
            rx="0.8"
            fill="currentColor"
          />
          <rect
            x="6"
            y="1"
            width="2"
            height="12"
            rx="0.8"
            fill="currentColor"
          />
          <rect
            x="9"
            y="1"
            width="2"
            height="12"
            rx="0.8"
            fill="currentColor"
          />
          <rect
            x="12"
            y="1"
            width="2"
            height="12"
            rx="0.8"
            fill="currentColor"
          />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-block;
      position: relative;
      flex-shrink: 0;
      width: 14px;
      height: 14px;
    }

    .layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      animation: layer-in ${FADE_MS}ms ease-out;
    }
    .layer.leaving {
      opacity: 0;
      transition: opacity ${FADE_MS}ms ease-out;
    }
    @keyframes layer-in {
      from {
        opacity: 0;
      }
    }

    .layer * {
      transform-box: fill-box;
      transform-origin: center;
    }
    .crossed {
      opacity: 0;
    }

    /* Antenna: slanted as in the logo, turning about its foot on the head. */
    .antenna {
      transform-box: view-box;
      transform-origin: 232px 104px;
    }

    /* Face, calm: still, a quick blink every five seconds; the antenna twitches along. */
    .face.calm .antenna {
      animation: antenna-twitch 5s ease-in-out infinite;
    }
    @keyframes antenna-twitch {
      0%, 95%, 99.5%, 100% { transform: rotate(0); }
      96.5%, 97.5% { transform: rotate(12deg); }
    }
    .face.calm .eye {
      animation: blink 5s ease-in-out infinite;
    }
    @keyframes blink {
      0%,
      95%,
      99%,
      100% {
        transform: scaleY(1);
      }
      96.5%,
      97% {
        transform: scaleY(0.1);
      }
    }

    /* Face, busy: one 8 s round. Reads three lines, looks up aside with a blink, bobs its head. */
    .face.busy .eyes {
      animation: busy-eyes 8s ease-in-out infinite;
    }
    .face.busy .eye {
      animation: busy-blink 8s ease-in-out infinite;
    }
    .face.busy .tilt {
      animation: busy-nod 8s ease-in-out infinite;
    }
    .face.busy .antenna {
      animation: antenna-sway 1.4s ease-in-out infinite;
    }
    @keyframes antenna-sway {
      0%, 100% { transform: rotate(-12deg); }
      50% { transform: rotate(10deg); }
    }
    @keyframes busy-eyes {
      0% {
        transform: translate(-17px, 0);
        animation-timing-function: linear;
      }
      12% {
        transform: translate(17px, 0);
      }
      15% {
        transform: translate(-17px, 0);
        animation-timing-function: linear;
      }
      27% {
        transform: translate(17px, 0);
      }
      30% {
        transform: translate(-17px, 0);
        animation-timing-function: linear;
      }
      42% {
        transform: translate(17px, 0);
      }
      47%,
      66% {
        transform: translate(15px, -18px);
      }
      70%,
      96% {
        transform: translate(0, 0);
      }
      100% {
        transform: translate(-17px, 0);
      }
    }
    @keyframes busy-blink {
      0%,
      56%,
      60%,
      100% {
        transform: scaleY(1);
      }
      57.5%,
      58% {
        transform: scaleY(0.1);
      }
    }
    @keyframes busy-nod {
      0%,
      70%,
      98%,
      100% {
        transform: translateY(0);
      }
      73.5%,
      80.5%,
      87.5%,
      94.5% {
        transform: translateY(-5px);
      }
      77%,
      84%,
      91% {
        transform: translateY(7px);
      }
    }

    /* Face, asking: tilts its head and opens its eyes wide. */
    .face.asking .tilt {
      animation: tilt 2.4s ease-in-out infinite;
    }
    .face.asking .eye {
      animation: wide 2.4s ease-in-out infinite;
    }
    .face.asking .antenna {
      animation: antenna-up 2.4s ease-in-out infinite;
    }
    @keyframes antenna-up {
      0%, 100% { transform: rotate(0); }
      18%, 70% { transform: rotate(-30deg); }
    }
    @keyframes tilt {
      0%,
      100% {
        transform: rotate(0);
      }
      18%,
      70% {
        transform: rotate(-13deg);
      }
    }
    @keyframes wide {
      0%,
      100% {
        transform: scale(1);
      }
      18%,
      70% {
        transform: scale(1.18);
      }
    }

    /* Face, failed: looks at you briefly, then its eyes turn to crosses (x x) and it shakes its head. */
    .face.failed .eye {
      animation: open-eyes 3.2s steps(1, end) infinite;
    }
    .face.failed .crossed {
      animation: cross-eyes 3.2s steps(1, end) infinite;
    }
    .face.failed .tilt {
      animation: shake 3.2s ease-in-out infinite;
    }
    /* The antenna ball beats like a warning light, slow enough to read at 14px. */
    .face.failed .ball {
      animation: ball-alarm 3.2s ease-in-out infinite;
    }
    @keyframes ball-alarm {
      0%, 22%, 92%, 100% { transform: scale(1); }
      32.94%, 54.81%, 76.69% { transform: scale(1.5); }
      43.88%, 65.75%, 87.62% { transform: scale(0.6); }
    }
    @keyframes open-eyes {
      0% {
        opacity: 1;
      }
      22% {
        opacity: 0;
      }
    }
    @keyframes cross-eyes {
      0% {
        opacity: 0;
      }
      22% {
        opacity: 1;
      }
    }
    @keyframes shake {
      0%,
      23%,
      41%,
      100% {
        transform: translateX(0);
      }
      27% {
        transform: translateX(-9px);
      }
      31% {
        transform: translateX(9px);
      }
      35% {
        transform: translateX(-9px);
      }
      38% {
        transform: translateX(5px);
      }
    }

    /* Equalizer: five bars, each at its own tempo, so it never looks like a loop. */
    .equalizer rect {
      transform-origin: center bottom;
    }
    .equalizer.busy rect {
      animation: equalizer-busy 0.6s ease-in-out infinite alternate;
    }
    .equalizer.busy rect:nth-child(1) {
      animation-duration: 0.62s;
      animation-delay: -0.3s;
    }
    .equalizer.busy rect:nth-child(2) {
      animation-duration: 0.44s;
      animation-delay: -0.1s;
    }
    .equalizer.busy rect:nth-child(3) {
      animation-duration: 0.71s;
      animation-delay: -0.55s;
    }
    .equalizer.busy rect:nth-child(4) {
      animation-duration: 0.5s;
      animation-delay: -0.2s;
    }
    .equalizer.busy rect:nth-child(5) {
      animation-duration: 0.58s;
      animation-delay: -0.42s;
    }
    @keyframes equalizer-busy {
      from {
        transform: scaleY(0.18);
      }
      to {
        transform: scaleY(1);
      }
    }

    /* Equalizer, calm: the command runs but has been quiet for a while; the bars swell low and slow. */
    .equalizer.calm rect {
      animation: equalizer-calm 1.8s ease-in-out infinite alternate;
    }
    .equalizer.calm rect:nth-child(2) {
      animation-delay: -0.36s;
    }
    .equalizer.calm rect:nth-child(3) {
      animation-delay: -0.72s;
    }
    .equalizer.calm rect:nth-child(4) {
      animation-delay: -1.08s;
    }
    .equalizer.calm rect:nth-child(5) {
      animation-delay: -1.44s;
    }
    @keyframes equalizer-calm {
      from {
        transform: scaleY(0.14);
      }
      to {
        transform: scaleY(0.34);
      }
    }

    /* Less motion: every mood as a still that still tells it apart. */
    @media (prefers-reduced-motion: reduce) {
      .layer,
      .layer * {
        animation: none !important;
        transition: none !important;
      }
      .face.failed .eye {
        opacity: 0;
      }
      .face.failed .crossed {
        opacity: 1;
      }
      .face.asking .tilt {
        transform: rotate(-13deg);
      }
      .face.asking .antenna {
        transform: rotate(-30deg);
      }
      .equalizer.busy rect {
        transform: scaleY(0.7);
      }
      .equalizer.calm rect {
        transform: scaleY(0.25);
      }
    }
  `,
})
export class StatusIndicatorComponent implements OnDestroy {
  /** What to show; none fades the indicator out. */
  indicator = input<StatusIndicator | undefined>(undefined);

  protected readonly maskId = `status-indicator-face-${nextMaskId++}`;
  protected readonly layers = signal<readonly Layer[]>([]);

  private nextLayerId = 0;
  private readonly fadeTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      const indicator = this.indicator();
      untracked(() => this.show(indicator));
    });
  }

  ngOnDestroy(): void {
    for (const timer of this.fadeTimers) clearTimeout(timer);
    this.fadeTimers.clear();
  }

  private show(indicator: StatusIndicator | undefined): void {
    const layers = this.layers();
    const current = layers.find((layer) => !layer.leaving);

    if (current && indicator && current.indicator.motif === indicator.motif) {
      if (current.indicator.mood === indicator.mood) return;
      this.layers.set(layers.map((layer) => (layer === current ? { ...layer, indicator } : layer)));
      return;
    }
    if (!current && !indicator) return;

    const next = layers.map((layer) => (layer === current ? { ...layer, leaving: true } : layer));
    if (indicator) next.push({ id: this.nextLayerId++, indicator, leaving: false });
    this.layers.set(next);

    if (current) {
      const timer = setTimeout(() => {
        this.fadeTimers.delete(timer);
        this.layers.update((all) => all.filter((layer) => layer.id !== current.id));
      }, FADE_MS);
      this.fadeTimers.add(timer);
    }
  }
}
