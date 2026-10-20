// sRGB hex <-> QMK hue and saturation (both 0-255). QMK keeps brightness as its
// own setting, so a colour here is hue and saturation only, at full value.

export function hexToHueSat(hex: string): { hue: number; sat: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: Math.round((h / 6) * 255) % 256, sat: max ? Math.round((d / max) * 255) : 0 };
}

export function hueSatToHex(hue: number, sat: number): string {
  const h = (hue / 255) * 6;
  const s = sat / 255;
  const f = (k: number) => {
    const x = (k + h) % 6;
    return 1 - s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return '#' + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}
