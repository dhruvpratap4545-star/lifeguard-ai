/**
 * Dark high-contrast design tokens matching the LifeGuard AI web app.
 * Derived from artifacts/lifeguard-ai/src/index.css :root block.
 *
 * HSL conversions:
 *   background  240 10%  4%  → #09090f
 *   card        240 10%  8%  → #111118
 *   cardBorder  240 10% 12%  → #1a1a26
 *   primary       0 84% 60%  → #ef4444
 *   secondary   240 10% 15%  → #21212e
 *   muted       240 10% 15%  → #21212e
 *   mutedFg     240  5% 65%  → #a1a1aa
 */

const colors = {
  // Both light and dark use the same dark palette — the app is always dark-themed
  light: {
    text: '#fafafa',
    tint: '#ef4444',

    background: '#09090f',
    foreground: '#fafafa',

    card: '#111118',
    cardForeground: '#fafafa',

    primary: '#ef4444',
    primaryForeground: '#ffffff',

    secondary: '#21212e',
    secondaryForeground: '#fafafa',

    muted: '#21212e',
    mutedForeground: '#a1a1aa',

    accent: '#ef4444',
    accentForeground: '#ffffff',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#1a1a26',
    input: '#21212e',

    success: '#22c55e',
    warning: '#eab308',
    info: '#3b82f6',
  },

  dark: {
    text: '#fafafa',
    tint: '#ef4444',

    background: '#09090f',
    foreground: '#fafafa',

    card: '#111118',
    cardForeground: '#fafafa',

    primary: '#ef4444',
    primaryForeground: '#ffffff',

    secondary: '#21212e',
    secondaryForeground: '#fafafa',

    muted: '#21212e',
    mutedForeground: '#a1a1aa',

    accent: '#ef4444',
    accentForeground: '#ffffff',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#1a1a26',
    input: '#21212e',

    success: '#22c55e',
    warning: '#eab308',
    info: '#3b82f6',
  },

  radius: 8,
};

export default colors;
