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
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: 'Midnight Indigo',
    description: 'Palet standar AeroCord dengan nuansa indigo & cyan kosmik yang sejuk.',
    previewGradient: 'from-indigo-600 to-cyan-500',
    accentColor: '#6366f1',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-400'
  },
  {
    id: 'oled',
    name: 'OLED Pure Black',
    description: 'Hitam pekat 100% #000000, sangat tajam dan hemat baterai layar AMOLED/OLED.',
    previewGradient: 'from-neutral-900 to-black',
    accentColor: '#ffffff',
    badgeBg: 'bg-white/10',
    badgeText: 'text-white'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Nuansa futuristik dengan kombinasi neon magenta, ungu elektrik, dan cyan.',
    previewGradient: 'from-fuchsia-600 to-cyan-400',
    accentColor: '#d946ef',
    badgeBg: 'bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-400'
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    description: 'Aksen hijau zamrud modern berpadu dengan latar belakang obsidian elegan.',
    previewGradient: 'from-emerald-600 to-teal-400',
    accentColor: '#10b981',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400'
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Palet hangat dengan semburat oranye matahari terbenam dan rose gold.',
    previewGradient: 'from-amber-500 to-rose-500',
    accentColor: '#f59e0b',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400'
  }
];

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  currentThemeOption: ThemeOption;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Manage theme class on body
    document.body.classList.remove('theme-midnight', 'theme-oled', 'theme-cyberpunk', 'theme-emerald', 'theme-sunset');
    document.body.classList.add(`theme-${theme}`);
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
