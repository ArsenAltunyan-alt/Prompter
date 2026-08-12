import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Суфлёр",
    short_name: "Суфлёр",
    description: "Записывайте видео с камерой и читайте текст с суфлёра.",
    id: "/",
    start_url: "/?mode=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#050506",
    theme_color: "#050506",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
