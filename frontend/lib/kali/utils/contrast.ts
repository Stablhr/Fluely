const cache = new Map<string, AdaptiveColorResult>()

export interface AdaptiveColorResult {
  foreground: string
  foregroundMuted: string
  foregroundFaint: string
  border: string
  icon: string
  surface: string
  contrastRatio: number
  isDark: boolean
}

// ── Color Parsing ────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }

function parseColor(input: string): RGB | null {
  if (!input) return null
  const s = input.trim()

  // hex
  const hexMatch = s.match(/^#([0-9a-f]{3,8})$/i)
  if (hexMatch) {
    let h = hexMatch[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    if (h.length < 6) return null
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }

  // rgb/rgba
  const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i)
  if (rgbMatch) return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] }

  // hsl/hsla — convert
  const hslMatch = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i)
  if (hslMatch) {
    const h = +hslMatch[1] / 360, sl = +hslMatch[2] / 100, l = +hslMatch[3] / 100
    if (sl === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v } }
    const q = l < 0.5 ? l * (1 + sl) : l + sl - l * sl
    const p = 2 * l - q
    const hue = (c: number) => {
      const t = c < 0 ? c + 1 : c > 1 ? c - 1 : c
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return { r: Math.round(hue(h + 1 / 3) * 255), g: Math.round(hue(h) * 255), b: Math.round(hue(h - 1 / 3) * 255) }
  }

  return null
}

// ── WCAG Relative Luminance (WCAG 2.1 §1.4.3) ──────────────

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance(rgb: RGB): number {
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b)
}

// ── WCAG Contrast Ratio ─────────────────────────────────────

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Foreground Selection ─────────────────────────────────────

const WHITE_LUM = relativeLuminance({ r: 255, g: 255, b: 255 })
const BLACK_LUM = relativeLuminance({ r: 0, g: 0, b: 0 })

interface FgCandidate {
  hex: string
  lum: number
  alpha?: number
}

const MUTED_LIGHT_CANDIDATES: FgCandidate[] = [
  { hex: '#FFFFFF', lum: WHITE_LUM, alpha: 0.7 },
  { hex: '#FFFFFF', lum: WHITE_LUM, alpha: 0.5 },
]

const MUTED_DARK_CANDIDATES: FgCandidate[] = [
  { hex: '#132A29', lum: relativeLuminance({ r: 19, g: 42, b: 41 }), alpha: 0.6 },
  { hex: '#132A29', lum: relativeLuminance({ r: 19, g: 42, b: 41 }), alpha: 0.45 },
]

const FAINT_LIGHT_CANDIDATES: FgCandidate[] = [
  { hex: '#FFFFFF', lum: WHITE_LUM, alpha: 0.5 },
  { hex: '#FFFFFF', lum: WHITE_LUM, alpha: 0.35 },
]

const FAINT_DARK_CANDIDATES: FgCandidate[] = [
  { hex: '#132A29', lum: relativeLuminance({ r: 19, g: 42, b: 41 }), alpha: 0.45 },
  { hex: '#132A29', lum: relativeLuminance({ r: 19, g: 42, b: 41 }), alpha: 0.3 },
]

function blendWithBackground(fgRGB: RGB, fgAlpha: number, bgRGB: RGB): RGB {
  return {
    r: Math.round(fgAlpha * fgRGB.r + (1 - fgAlpha) * bgRGB.r),
    g: Math.round(fgAlpha * fgRGB.g + (1 - fgAlpha) * bgRGB.g),
    b: Math.round(fgAlpha * fgRGB.b + (1 - fgAlpha) * bgRGB.b),
  }
}

function pickBestForeground(bgLum: number, bgRGB: RGB, candidates: FgCandidate[], minRatio: number): { hex: string; ratio: number } {
  for (const c of candidates) {
    const cRGB = parseColor(c.hex)!
    const blended = c.alpha != null ? blendWithBackground(cRGB, c.alpha, bgRGB) : cRGB
    const blendedLum = c.alpha != null ? relativeLuminance(blended) : c.lum
    const ratio = contrastRatio(bgLum, blendedLum)
    if (ratio >= minRatio) {
      return { hex: c.hex, ratio }
    }
  }
  // fallback: pick whichever of black/white has better ratio
  const whiteRatio = contrastRatio(bgLum, WHITE_LUM)
  const blackRatio = contrastRatio(bgLum, BLACK_LUM)
  if (whiteRatio >= blackRatio) return { hex: '#FFFFFF', ratio: whiteRatio }
  return { hex: '#000000', ratio: blackRatio }
}

// ── Public API ───────────────────────────────────────────────

export function getAccessibleColors(bgColor: string): AdaptiveColorResult {
  const cached = cache.get(bgColor)
  if (cached) return cached

  const bgRGB = parseColor(bgColor)
  if (!bgRGB) {
    // fallback: default Flowline theme
    const result: AdaptiveColorResult = {
      foreground: '#132A29',
      foregroundMuted: '#5C7C79',
      foregroundFaint: '#94AFAC',
      border: '#CDEBE7',
      icon: '#5C7C79',
      surface: '#FFFFFF',
      contrastRatio: 21,
      isDark: false,
    }
    cache.set(bgColor, result)
    return result
  }

  const bgLum = relativeLuminance(bgRGB)
  const isDark = bgLum < 0.179

  // Primary text: target WCAG AA 4.5:1
  const primary = pickBestForeground(bgLum, bgRGB, [
    { hex: '#FFFFFF', lum: WHITE_LUM },
    { hex: '#F8FAFC', lum: relativeLuminance({ r: 248, g: 250, b: 252 }) },
    { hex: '#132A29', lum: relativeLuminance({ r: 19, g: 42, b: 41 }) },
    { hex: '#000000', lum: BLACK_LUM },
  ], 4.5)

  // Muted text: target 3:1 (WCAG large text) — use alpha-blended candidates
  const mutedCandidates = isDark ? MUTED_LIGHT_CANDIDATES : MUTED_DARK_CANDIDATES
  const muted = pickBestForeground(bgLum, bgRGB, mutedCandidates, 3)

  // Faint text: target 2.5:1 minimum — even more alpha
  const faintCandidates = isDark ? FAINT_LIGHT_CANDIDATES : FAINT_DARK_CANDIDATES
  const faint = pickBestForeground(bgLum, bgRGB, faintCandidates, 2.5)

  // Border: slightly stronger than faint
  const borderRGB = isDark
    ? blendWithBackground({ r: 255, g: 255, b: 255 }, 0.15, bgRGB)
    : blendWithBackground({ r: 0, g: 0, b: 0 }, 0.1, bgRGB)

  const result: AdaptiveColorResult = {
    foreground: primary.hex,
    foregroundMuted: muted.hex,
    foregroundFaint: faint.hex,
    border: `rgb(${borderRGB.r},${borderRGB.g},${borderRGB.b})`,
    icon: muted.hex,
    surface: isDark
      ? `rgba(255,255,255,0.08)`
      : `rgba(0,0,0,0.04)`,
    contrastRatio: primary.ratio,
    isDark,
  }

  cache.set(bgColor, result)
  return result
}
