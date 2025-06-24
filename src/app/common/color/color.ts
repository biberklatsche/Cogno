import {TinyColor} from '@ctrl/tinycolor';

export namespace Color {
  export function hslFromString(color: string): string {
    let hash = 0;
    if (color.length > 0) {
      for (let i = 0; i < color.length; i++) {
        hash = color.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
      }
    }
    return `hsl(${hash % 360},100%,30%)`;
  }

  export function getHexOpacity(opacity: number): string {
    let result = '';
    if (opacity || opacity === 0) {
      if (opacity > 100) {
        opacity = 100;
      }
      if (opacity < 0) {
        opacity = 0;
      }
      const decimalValue = Math.round(opacity * 255 / 100);
      if (opacity < 7) {
        result = '0' + decimalValue.toString(16).toUpperCase();
      } else {
        result = decimalValue.toString(16).toUpperCase();
      }
    }
    return result;
  }

  export function lightenDarkenColor(col: string, amt: number): string {
    amt = Math.floor(amt);
    if (col[0] === '#') {
      col = col.slice(1);
    }
    let opacity = '';
    if (col.length === 8) {
      opacity = col.slice(6, 8);
      col = col.slice(0, 6);
    }
    const num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    if (r > 255) {
      r = 255;
    } else if (r < 0) {
      r = 0;
    }
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) {
      b = 255;
    } else if (b < 0) {
      b = 0;
    }
    let g = (num & 0x0000FF) + amt;
    if (g > 255) {
      g = 255;
    } else if (g < 0) {
      g = 0;
    }
    const [rs, gs, bs] = [r, g, b].map(color => color <= 15 ? `0${color.toString(16)}` : color.toString(16));
    return '#' + rs + bs + gs + opacity;
  }

  export function isValid(color: string): boolean {
    try {
      if (!color || color.length < 7 || color.length > 7 || color[0] !== '#') {
        return false;
      }
      parseInt(color.substring(1, 6), 16);
      return true;
    } catch {
      return false;
    }
  }

  export function getBrightness(col: string): number {
    const c = new TinyColor(col);
    return c.getBrightness() / 255;
  }

  export function isLight(col: string): boolean {
    const c = new TinyColor(col);
    return c.isLight();
  }
}
