'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    console.log('ThemeProvider mounted');
    // Load theme from localStorage on client
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme;
      console.log('Saved theme from localStorage:', savedTheme);
      if (savedTheme) {
        setTheme(savedTheme);
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
          console.log('Initial: Added dark class');
        } else {
          document.documentElement.classList.remove('dark');
          console.log('Initial: Removed dark class');
        }
      } else {
        // Default to dark mode
        console.log('No saved theme, defaulting to dark');
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.add('dark');
      }
      console.log('Initial HTML classes:', document.documentElement.className);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    console.log('Toggle theme called. Current:', theme, 'New:', newTheme);
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      console.log('Saved to localStorage:', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
        console.log('Added dark class to html');
      } else {
        document.documentElement.classList.remove('dark');
        console.log('Removed dark class from html');
      }
      console.log('HTML classes:', document.documentElement.className);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

