import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'midnight' | 'oled' | 'cyberpunk' | 'emerald' | 'sunset';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  description: string;
  previewGradient: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  vars: {
    bgMain: string;
    bgSurface: string;
    bgCard: string;
    bgElevated: string;
    brandPrimary: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    description: 'Palet standar AeroCord dengan nuansa indigo & cyan kosmik yang sejuk.',
    previewGradient: 'from-indigo-600 to-cyan-500',
    accentColor: '#6366f1',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-400',
    vars: {
      bgMain: '#0b0c10',
      bgSurface: '#11131a',
      bgCard: '#13161f',
      bgElevated: '#181b24',
      brandPrimary: '#6366f1',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
    },
  },
  {
    id: 'oled',
    name: 'OLED Pure Black',
    description: 'Hitam pekat 100% #000000, sangat tajam dan hemat baterai layar AMOLED/OLED.',
    previewGradient: 'from-neutral-900 to-black',
    accentColor: '#ffffff',
    badgeBg: 'bg-white/10',
    badgeText: 'text-white',
    vars: {
      bgMain: '#000000',
      bgSurface: '#0a0a0a',
      bgCard: '#121212',
      bgElevated: '#1a1a1a',
      brandPrimary: '#38bdf8',
      textPrimary: '#ffffff',
      textSecondary: '#a3a3a3',
      textMuted: '#737373',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Nuansa futuristik dengan kombinasi neon magenta, ungu elektrik, dan cyan.',
    previewGradient: 'from-fuchsia-600 to-cyan-400',
    accentColor: '#d946ef',
    badgeBg: 'bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-400',
    vars: {
      bgMain: '#0d0614',
      bgSurface: '#150a21',
      bgCard: '#1d0e2e',
      bgElevated: '#28133f',
      brandPrimary: '#d946ef',
      textPrimary: '#fdf4ff',
      textSecondary: '#d8b4fe',
      textMuted: '#a855f7',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    description: 'Aksen hijau zamrud modern berpadu dengan latar belakang obsidian elegan.',
    previewGradient: 'from-emerald-600 to-teal-400',
    accentColor: '#10b981',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    vars: {
      bgMain: '#06110d',
      bgSurface: '#0a1b15',
      bgCard: '#0f261e',
      bgElevated: '#16362b',
      brandPrimary: '#10b981',
      textPrimary: '#f0fdf4',
      textSecondary: '#a7f3d0',
      textMuted: '#6ee7b7',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Palet hangat dengan semburat oranye matahari terbenam dan rose gold.',
    previewGradient: 'from-amber-500 to-rose-500',
    accentColor: '#f59e0b',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    vars: {
      bgMain: '#140a08',
      bgSurface: '#1f100d',
      bgCard: '#2c1612',
      bgElevated: '#3a1e19',
      brandPrimary: '#f59e0b',
      textPrimary: '#fffbeb',
      textSecondary: '#fde68a',
      textMuted: '#fbbf24',
    },
  },
];

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  currentThemeOption: ThemeOption;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeVars(opt: ThemeOption) {
  const root = document.documentElement;
  const { vars } = opt;

  // Set CSS custom properties on :root so var() references work everywhere
  root.style.setProperty('--bg-main', vars.bgMain);
  root.style.setProperty('--bg-surface', vars.bgSurface);
  root.style.setProperty('--bg-card', vars.bgCard);
  root.style.setProperty('--bg-elevated', vars.bgElevated);
  root.style.setProperty('--brand-primary', vars.brandPrimary);
  root.style.setProperty('--text-primary', vars.textPrimary);
  root.style.setProperty('--text-secondary', vars.textSecondary);
  root.style.setProperty('--text-muted', vars.textMuted);

  // Set data-theme for CSS @layer selectors
  root.setAttribute('data-theme', opt.id);

  // Inject a <style> tag that overrides Tailwind's hardcoded hex utility classes
  // This is the only reliable way to remap bg-[#hex] without editing every component.
  const styleId = 'aerocord-theme-override';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  if (opt.id === 'midnight') {
    // Default theme — no override needed
    styleEl.textContent = '';
    return;
  }

  styleEl.textContent = `
    /* AeroCord theme override — applied by ThemeContext */
    .bg-\\[\\#0b0c10\\] { background-color: ${vars.bgMain} !important; }
    .bg-\\[\\#11131a\\] { background-color: ${vars.bgSurface} !important; }
    .bg-\\[\\#13161f\\] { background-color: ${vars.bgCard} !important; }
    .bg-\\[\\#181b24\\] { background-color: ${vars.bgElevated} !important; }

    /* Opacity / glass variants */
    .bg-\\[\\#11131a\\]\\/80 { background-color: ${vars.bgSurface}cc !important; }
    .bg-\\[\\#11131a\\]\\/90 { background-color: ${vars.bgSurface}e6 !important; }
    .bg-\\[\\#13161f\\]\\/95 { background-color: ${vars.bgCard}f2 !important; }
    .bg-\\[\\#13161f\\]\\/96 { background-color: ${vars.bgCard}f5 !important; }

    /* Body / root */
    body, #root { background-color: ${vars.bgMain} !important; color: ${vars.textPrimary} !important; }
  `;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('aerocord_theme');
      if (saved && ['midnight', 'oled', 'cyberpunk', 'emerald', 'sunset'].includes(saved)) {
        return saved as AppTheme;
      }
    } catch {}
    return 'midnight';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('aerocord_theme', newTheme);
    } catch {}
  };

  useEffect(() => {
    const opt = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];
    applyThemeVars(opt);
  }, [theme]);

  const currentThemeOption = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentThemeOption }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
