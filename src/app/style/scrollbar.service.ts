import { Injectable, OnDestroy } from '@angular/core';

/**
 * Service responsible for controlling the visibility/animation state
 * of a custom scrollbar by toggling the `scrolling` class on <body>.
 *
 * Modes:
 * - 'never':  never add the class
 * - 'always': keep the class permanently
 * - 'auto'  : add class while the user is scrolling and remove after a delay
 */
@Injectable({ providedIn: 'root' })
export class ScrollbarService implements OnDestroy {
  private mode: 'never' | 'always' | 'auto' = 'auto';
  private scrollingTimeoutId: any = null;
  private onWheelHandler = () => this.handleUserScroll();

  constructor() {
    this.init();
  }

  /**
   * Change runtime mode if needed (e.g., from a settings page)
   */
  setMode(mode: 'never' | 'always' | 'auto'): void {
    if (this.mode === mode) return;

    // cleanup previous listeners/state
    this.dispose();
    this.mode = mode;
    this.init();
  }

  private init(): void {
    const config = this.mode;

    if (config === 'never') {
      // Ensure class is not present
      document.body.classList.remove('scrolling');
      return;
    }

    if (config === 'always') {
      const body = document.body;
      if (!body.classList.contains('scrolling')) {
        body.classList.add('scrolling');
      }
      return;
    }

    // auto mode: listen to wheel events
    window.addEventListener('wheel', this.onWheelHandler as any, { passive: true } as any);
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
    window.removeEventListener('wheel', this.onWheelHandler as any, false as any);
    if (this.scrollingTimeoutId) {
      clearTimeout(this.scrollingTimeoutId);
      this.scrollingTimeoutId = null;
    }
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}
