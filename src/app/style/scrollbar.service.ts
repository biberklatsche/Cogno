import { DestroyRef, Injectable, OnDestroy } from '@angular/core';
import { ConfigService } from '../config/+state/config.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {ScrollbarVisibility} from "../config/+models/config.types";

/**
 * Controls the visibility/animation state of the custom scrollbar by toggling
 * the `scrolling` class on <body>.
 *
 * Visibility values (from config):
 * - 'hidden': never add the class
 * - 'always': keep the class permanently
 * - 'auto'  : add class while the user is scrolling and remove after a delay
 */
@Injectable({ providedIn: 'root' })
export class ScrollbarService implements OnDestroy {
  private visibility: ScrollbarVisibility = 'hidden';
  private scrollingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onWheelHandler: EventListener = () => this.handleUserScroll();

  constructor(configService: ConfigService, destroyRef: DestroyRef) {
      this.init();
      configService.config$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(config => {
        const visibility = config.scrollbar?.visibility ?? 'auto';
        this.setVisibility(visibility);
      });
  }

  /**
   * Change runtime visibility (driven by config or manual override)
   */
  setVisibility(visibility: ScrollbarVisibility): void {
    if (this.visibility === visibility) return;
    // cleanup previous listeners/state
    this.dispose();
    this.visibility = visibility;
    this.init();
  }

  private init(): void {
    const visibility = this.visibility;

    if (visibility === 'hidden') {
      // Ensure class is not present
      document.body.classList.remove('scrolling');
      return;
    }

    if (visibility === 'always') {
      const body = document.body;
      if (!body.classList.contains('scrolling')) {
        body.classList.add('scrolling');
      }
      return;
    }

    // auto: listen to wheel events
    window.addEventListener('wheel', this.onWheelHandler, { passive: true });
  }

  private handleUserScroll(): void {
    const body = document.body;

    if (!body.classList.contains('scrolling')) {
      body.classList.add('scrolling');
    }

    if (this.scrollingTimeoutId) {
      clearTimeout(this.scrollingTimeoutId);
    }
    this.scrollingTimeoutId = setTimeout(() => {
      body.classList.remove('scrolling');
      this.scrollingTimeoutId = null;
    }, 600);
  }

  private dispose(): void {
    // remove with matching capture option (false)
    window.removeEventListener('wheel', this.onWheelHandler, false);
    if (this.scrollingTimeoutId) {
      clearTimeout(this.scrollingTimeoutId);
      this.scrollingTimeoutId = null;
    }
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}
