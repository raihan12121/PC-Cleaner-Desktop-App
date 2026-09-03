import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('app_theme') as Theme;
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
            return saved;
        }
        return 'dark';
    });

    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        if (theme === 'system') {
            return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
        }
        return theme;
    });

    useEffect(() => {
        const updateResolvedTheme = () => {
            let active: ResolvedTheme = 'dark';
            if (theme === 'system') {
                active = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
            } else {
                active = theme;
            }
            setResolvedTheme(active);

            // Update DOM class
            const root = document.documentElement;
            root.classList.remove('dark', 'light');
            root.classList.add(active);
            root.setAttribute('data-theme', active);

            document.body.classList.remove('dark', 'light');
            document.body.classList.add(active);

            // Sync with Electron titleBarOverlay
            if (window.api?.invoke) {
                window.api.invoke('theme:set', theme).catch(() => {});
            }
        };

        updateResolvedTheme();

        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                updateResolvedTheme();
            }
        };

        mediaQuery?.addEventListener?.('change', handleChange);
        return () => mediaQuery?.removeEventListener?.('change', handleChange);
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('app_theme', newTheme);
    };

    const toggleTheme = () => {
        if (resolvedTheme === 'dark') {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
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
