import { Component, OnInit, signal } from "@angular/core";
import { Opener } from "@cogno/app-tauri/opener";
import { Path } from "@cogno/app-tauri/path";
import { DialogRef } from "@cogno/core-ui";
import { getVersion } from "@tauri-apps/api/app";

@Component({
  selector: "app-about-dialog",
  standalone: true,
  styles: [
    `
      .about {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        min-width: 20rem;
        padding: 1.5rem 2.5rem 2rem;
        text-align: center;
      }

      .about__icon svg {
        display: block;
        height: 4.5rem;
        width: 4.5rem;
      }

      .about__name {
        font-size: 1.6rem;
        font-weight: 600;
        margin: 0.25rem 0 0;
      }

      .about__tagline {
        font-size: 0.875rem;
        margin: 0;
        opacity: 0.65;
      }

      .about__version {
        font-family: monospace;
        font-size: 0.8rem;
        margin-top: 0.25rem;
        opacity: 0.5;
      }

      .about__link {
        background: none;
        border: none;
        color: var(--highlight-color);
        cursor: pointer;
        font-size: 0.85rem;
        margin-top: 0.5rem;
        padding: 0;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .about__link:hover {
        opacity: 0.8;
      }
    `,
  ],
  template: `
    <div class="about">
      <div class="about__icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="200" cy="200" r="198" fill="var(--foreground-color)"></circle>
          <path
            d="M300 95 C 292 98,287 110,285 131 C 283 145,283 260,285 272 C 294 321,313 311,318 256 C 326 173,316 88,299 95 M97 114 C 91 116,78 129,70.174 141 C 40 184,46 237,84.368 274 C 95 285,97 286,108 286 C 132 286,168 270,211 239 C 220 232,249 208,250 205 C 254 200,252 193,245 188 C 243 186,239 183,236 180 C 194 140,121 105,97 114 M130 148 C 136 150,170 166,188 180 C 191 182,196 186,199 189 C 210 197,209 201,196 212 C 163 239,129 256,113 252 C 109 251,98 240,94 233 C 78 208,83 173,104 153 C 112 146,118 145,130 148"
            fill="var(--background-color)"
          ></path>
        </svg>
      </div>
      <h2 class="about__name">Cogno</h2>
      <p class="about__tagline">The terminal for the AI era.</p>
      <span class="about__version">v{{ version() }}</span>
      <button type="button" class="about__link" (click)="openLog()">Open log</button>
    </div>
  `,
})
export class AboutDialogComponent implements OnInit {
  readonly version = signal("…");

  constructor(private readonly dialogRef: DialogRef<void>) {}

  async ngOnInit(): Promise<void> {
    const v = await getVersion();
    this.version.set(v);
  }

  async openLog(): Promise<void> {
    const logPath = await Path.cognoLogFilePath();
    await Opener.openPath(logPath);
    this.dialogRef.close();
  }
}
