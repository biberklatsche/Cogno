import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  linkedSignal,
  OnDestroy,
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

let nextLayerId = 0;

/**
 * The layers after the indicator changed: the same motif changes its mood in
 * place; another motif, or none, sends the current layer leaving.
 */
function nextLayers(
  layers: readonly Layer[],
  indicator: StatusIndicator | undefined,
): readonly Layer[] {
  const current = layers.find((layer) => !layer.leaving);
  if (current && indicator && current.indicator.motif === indicator.motif) {
    if (current.indicator.mood === indicator.mood) return layers;
    return layers.map((layer) => (layer === current ? { ...layer, indicator } : layer));
  }
  if (!current && !indicator) return layers;
  const next = layers.map((layer) => (layer === current ? { ...layer, leaving: true } : layer));
  return indicator ? [...next, { id: nextLayerId++, indicator, leaving: false }] : next;
}

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
          class="layer face"
          [class]="layer.indicator.mood"
          [class.leaving]="layer.leaving"
        >
          <defs>
            <mask
              [attr.id]="'status-face-' + layer.id"
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
            [attr.mask]="'url(#status-face-' + layer.id + ')'"
          />
        </svg>
      } @else {
        <div
          class="layer equalizer"
          [class]="layer.indicator.mood"
          [class.leaving]="layer.leaving"
          aria-hidden="true"
        >
          @for (bar of bars; track bar) {
            <span class="bar" [style.--i]="bar"></span>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: inline-block;
      vertical-align: middle;
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
    /* An animation, not a transition: a layer that leaves while still fading in must not wait for that. */
    .layer.leaving {
      opacity: 0;
      animation: layer-out ${FADE_MS}ms ease-out;
    }
    @keyframes layer-in {
      from {
        opacity: 0;
      }
    }
    @keyframes layer-out {
      from {
        opacity: 1;
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

    /* Face, busy: one 6.4 s round. Reads three lines, glances up with a blink, reads on; the head
       bobs all the while and the antenna swings from its rest pose to the left and back, once per
       two nods. Slow enough to read as a bob at 14px, and it starts where the other moods stand. */
    .face.busy .eyes {
      animation: busy-eyes 6.4s ease-in-out infinite;
    }
    .face.busy .eye {
      animation: busy-blink 6.4s ease-in-out infinite;
    }
    .face.busy .tilt {
      animation: busy-nod 0.8s ease-in-out infinite;
    }
    .face.busy .antenna {
      animation: antenna-sway 1.6s ease-in-out infinite;
    }
    @keyframes antenna-sway {
      0%, 100% { transform: rotate(0); }
      50% { transform: rotate(-58deg); }
    }
    @keyframes busy-eyes {
      0% {
        transform: translate(-17px, 0);
        animation-timing-function: linear;
      }
      17.14% {
        transform: translate(17px, 0);
      }
      21.43% {
        transform: translate(-17px, 0);
        animation-timing-function: linear;
      }
      38.57% {
        transform: translate(17px, 0);
      }
      42.86% {
        transform: translate(-17px, 0);
        animation-timing-function: linear;
      }
      60% {
        transform: translate(17px, 0);
      }
      67.14%,
      85.71% {
        transform: translate(15px, -18px);
      }
      100% {
        transform: translate(-17px, 0);
      }
    }
    @keyframes busy-blink {
      0%,
      73.8%,
      79.5%,
      100% {
        transform: scaleY(1);
      }
      75.9%,
      76.6% {
        transform: scaleY(0.1);
      }
    }
    @keyframes busy-nod {
      0%,
      100% {
        transform: translateY(-5px);
      }
      50% {
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

    /* Equalizer: five HTML bars, so WebKit can run their transforms on the compositor. Each bar
       keeps its own tempo while busy, so it never looks like a loop. */
    .equalizer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      box-sizing: border-box;
      padding-block: 7%;
    }
    .equalizer .bar {
      width: 14%;
      height: 100%;
      border-radius: 1px;
      background: currentColor;
      transform-origin: center bottom;
      will-change: transform;
    }
    .equalizer.busy .bar {
      animation-name: equalizer-busy;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }
    .equalizer.busy .bar:nth-child(1) {
      animation-duration: 0.62s;
      animation-delay: -0.3s;
    }
    .equalizer.busy .bar:nth-child(2) {
      animation-duration: 0.44s;
      animation-delay: -0.1s;
    }
    .equalizer.busy .bar:nth-child(3) {
      animation-duration: 0.71s;
      animation-delay: -0.55s;
    }
    .equalizer.busy .bar:nth-child(4) {
      animation-duration: 0.5s;
      animation-delay: -0.2s;
    }
    .equalizer.busy .bar:nth-child(5) {
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

    /* Equalizer, calm: the command runs but has been quiet for a while; the bars swell low and slow, as a wave. */
    .equalizer.calm .bar {
      animation: equalizer-calm 1.8s ease-in-out calc(var(--i) * -0.36s) infinite alternate;
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
      .equalizer.busy .bar {
        transform: scaleY(0.7);
      }
      .equalizer.calm .bar {
        transform: scaleY(0.25);
      }
    }
  `,
})
export class StatusIndicatorComponent implements OnDestroy {
  /** What to show; none fades the indicator out. */
  indicator = input<StatusIndicator | undefined>(undefined);

  protected readonly bars = [0, 1, 2, 3, 4];
  protected readonly layers = linkedSignal<StatusIndicator | undefined, readonly Layer[]>({
    source: this.indicator,
    computation: (indicator, previous) => nextLayers(previous?.value ?? [], indicator),
  });

  /** The removal of each leaving layer, due FADE_MS after it started leaving. */
  private readonly fadeOuts = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      for (const layer of this.layers()) {
        if (!layer.leaving || this.fadeOuts.has(layer.id)) continue;
        const timer = setTimeout(() => {
          this.fadeOuts.delete(layer.id);
          this.layers.update((layers) => layers.filter((other) => other.id !== layer.id));
        }, FADE_MS);
        this.fadeOuts.set(layer.id, timer);
      }
    });
  }

  ngOnDestroy(): void {
    for (const timer of this.fadeOuts.values()) clearTimeout(timer);
  }
}
