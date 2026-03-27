// ============================================================
// Site Configuration — edit this file to rebrand the whole app
// ============================================================

export const SITE_CONFIG = {
  /** Company / product name shown in the UI */
  name: 'Prospect Tracker',

  /** Short tagline (login page, etc.) */
  tagline: 'B2B prospect management',

  /** Default map centre [lat, lng] and zoom */
  map: {
    center: [51.45, -2.59] as [number, number],
    zoom: 12,
  },

  /** Session cookie lifetime in seconds (default: 7 days) */
  sessionMaxAge: 60 * 60 * 24 * 7,

  /** Default category colour when none is specified */
  defaultCategoryColor: '#0d2c3d',

  /** Map tile provider — use any raster tile URL template */
  mapTileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  mapTileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
} as const;

// ──────────────────────────────────────────────────────────────
// Theme — every colour used across the app
// Change `accent` to rebrand; adjust the rest for light/dark.
// ──────────────────────────────────────────────────────────────

export const THEME = {
  /** Primary brand colour */
  accent: '#123d53',
  /** Darker variant (buttons, hover states) */
  accentDark: '#0d2c3d',

  /** Page background (törtfehér / off-white) */
  base: '#f5f2ed',
  /** Card / panel backgrounds */
  surface: '#ffffff',
  /** Input backgrounds, elevated areas */
  elevated: '#eceae5',
  /** Borders, dividers */
  border: '#d4d0ca',

  /** Primary text */
  textPrimary: '#1a1a2e',
  /** Secondary text (descriptions, meta) */
  textSecondary: '#5a6070',
  /** Muted text (labels, placeholders) */
  textMuted: '#8a8f9c',

  /** Scrollbar hover */
  scrollbarHover: '#c0bdb7',

  /** Overlay backdrop for modals/drawers */
  overlay: 'rgba(0, 0, 0, 0.3)',

  /** Button text on accent background */
  accentForeground: '#ffffff',
} as const;
