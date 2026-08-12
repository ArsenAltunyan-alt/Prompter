import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050506",
};

export const metadata: Metadata = {
  title: "Суфлер",
  description:
    "Записывайте видео с камерой и читайте",
  applicationName: "Суфлёр",
  manifest: "/manifest.webmanifest?v=3",
  appleWebApp: {
    capable: true,
    title: "Суфлёр",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.png?v=3", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-icon.png?v=3", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Суфлёр" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=3" />
      </head>
      <body>{children}</body>
    </html>
  );
}
