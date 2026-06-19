import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Open Scripture Explorer",
  description: "Installable Hebrew-first Tanakh reader with offline scripture access and verified search.",
  manifest: "/manifest.webmanifest",
  applicationName: "Open Scripture Explorer",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://open-scripture-explorer.vercel.app"),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "OSE",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Open Scripture Explorer",
    description: "Installable Hebrew-first Tanakh reader with offline scripture access and verified search.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
