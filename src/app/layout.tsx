import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import HeaderCheck from "./components/HeaderCheck";
import { ThemeProvider } from "./contexts/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stock Research Platform",
  description: "Comprehensive stock analysis and research tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider>
          <HeaderCheck>
            <Navigation />
            {children}
          </HeaderCheck>
        </ThemeProvider>
      </body>
    </html>
  );
}