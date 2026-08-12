import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Оратор — мобильный видеосуфлёр",
  description:
    "Записывайте видео с камерой и читайте плавно движущийся текст прямо у объектива.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
