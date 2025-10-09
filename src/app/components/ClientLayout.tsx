'use client';

import { ThemeProvider } from '../contexts/ThemeContext';
import Navigation from './Navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Navigation />
      {children}
    </ThemeProvider>
  );
}

