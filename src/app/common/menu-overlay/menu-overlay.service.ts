import {ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, Type, createComponent} from '@angular/core';
import { MenuOverlayComponent, ContextMenuOverlayComponent } from './menu-overlay.types';
import { ContextMenuComponent } from './context-menu.component';

export type Point = { x: number; y: number };

export interface MenuOverlayRef {
  close: () => void;
  isOpen: () => boolean;
}

@Injectable({ providedIn: 'root' })
export class MenuOverlayService {
  private current?: {
    host: HTMLDivElement;
    compRef: ComponentRef<unknown>;
    removeOutsideListener: () => void;
    removeKeyListener: () => void;
    removeScrollResizeListener: () => void;
  };

  private lastOpenEventTs = 0;

  constructor(private appRef: ApplicationRef, private env: EnvironmentInjector) {}

  openAt<T extends MenuOverlayComponent>(pointOrEvent: Point | MouseEvent, component: Type<T>, inputs?: Partial<T>): MenuOverlayRef {
    const point: Point = this.toPoint(pointOrEvent);
    this.lastOpenEventTs = this.isMouseEvent(pointOrEvent) ? pointOrEvent.timeStamp : performance.now();

    // Close existing overlay first
    this.close();

    // Create host
    const host = document.createElement('div');
    host.classList.add('menu-overlay-host');
    Object.assign(host.style, {
      position: 'fixed',
      left: point.x + 'px',
      top: point.y + 2 + 'px',
      zIndex: '100000',
      visibility: 'hidden', // position first, then reveal after clamp
    } as CSSStyleDeclaration);

    document.body.appendChild(host);

    // Create component
    const compRef = createComponent(component, {
      environmentInjector: this.env,
      hostElement: host,
    });

    // Provide default close() to component if it declares one
    const instance = compRef.instance as T;
    instance.close = instance.close ?? (() => this.close());

    // Apply inputs
    if (inputs) {
      Object.assign(instance, inputs);
    }

    this.appRef.attachView(compRef.hostView);

    // Position within viewport after first paint/layout
    requestAnimationFrame(() => {
      this.repositionWithinViewport(host);
      host.style.visibility = 'visible';
    });

    // Outside click/pointer close
    const pointerListener = (ev: PointerEvent) => {
      // Ignore the very event that triggered open
      if (Math.abs(ev.timeStamp - this.lastOpenEventTs) < 2) return;
      if (!host.contains(ev.target as Node)) {
        this.close();
      }
    };
    document.addEventListener('pointerdown', pointerListener, true);

    // ESC close
    const keyListener = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', keyListener, true);

    // Close on scroll/resize (keeps simple and prevents desync)
    const sr = () => this.close();
    window.addEventListener('scroll', sr, true);
    window.addEventListener('resize', sr, true);

    this.current = {
      host,
      compRef,
      removeOutsideListener: () => document.removeEventListener('pointerdown', pointerListener, true),
      removeKeyListener: () => document.removeEventListener('keydown', keyListener, true),
      removeScrollResizeListener: () => {
        window.removeEventListener('scroll', sr, true);
        window.removeEventListener('resize', sr, true);
      },
    };

    const ref: MenuOverlayRef = {
      close: () => this.close(),
      isOpen: () => !!this.current,
    };

    return ref;
  }

  // Convenience: fixed context menu openers
  openContextAt(pointOrEvent: Point | MouseEvent, inputs?: Partial<ContextMenuOverlayComponent>): MenuOverlayRef {
    return this.openAt(pointOrEvent, ContextMenuComponent, inputs as any);
  }

  openContextForElement(el: HTMLElement, inputs?: Partial<ContextMenuOverlayComponent>): MenuOverlayRef {
    const rect = el.getBoundingClientRect();
    const point: Point = { x: rect.left, y: rect.bottom };
    return this.openAt(point, ContextMenuComponent, inputs as any);
  }

  close() {
    if (!this.current) return;
    const { host, compRef, removeKeyListener, removeOutsideListener, removeScrollResizeListener } = this.current;
    removeOutsideListener();
    removeKeyListener();
    removeScrollResizeListener();
    this.appRef.detachView(compRef.hostView);
    compRef.destroy();
    host.remove();
    this.current = undefined;
  }

  private repositionWithinViewport(host: HTMLDivElement) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 8; // keep a little gap to the viewport edges

    // Measure current size/pos
    let rect = host.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    let w = rect.width;
    let h = rect.height;

    // Constrain size if menu is larger than viewport
    const maxW = Math.max(0, vw - padding * 2);
    const maxH = Math.max(0, vh - padding * 2);

    // Apply size constraints first so the next measurement reflects scrollbars, etc.
    if (w > maxW) {
      host.style.maxWidth = maxW + 'px';
      host.style.overflowX = 'auto';
    }
    if (h > maxH) {
      host.style.maxHeight = maxH + 'px';
      host.style.overflowY = 'auto';
    }

    // Re-measure after constraints possibly changed layout
    rect = host.getBoundingClientRect();
    w = rect.width;
    h = rect.height;

    // Clamp position within viewport with padding
    if (left + w > vw - padding) left = Math.max(padding, vw - padding - w);
    if (top + h > vh - padding) top = Math.max(padding, vh - padding - h);
    if (left < padding) left = padding;
    if (top < padding) top = padding;

    host.style.left = left + 'px';
    host.style.top = top + 'px';
  }

  private isMouseEvent(p: Point | MouseEvent): p is MouseEvent {
    return typeof (p as MouseEvent).clientX === 'number' && typeof (p as MouseEvent).clientY === 'number';
  }

  private toPoint(p: Point | MouseEvent): Point {
    if (this.isMouseEvent(p)) {
      return { x: p.clientX, y: p.clientY };
    }
    return p;
  }
}
