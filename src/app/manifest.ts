import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BAKU | 고려대학교 제과제빵동아리",
    short_name: "BAKU",
    description: "고려대학교 유일 제과제빵동아리 BAKU 공식 홈페이지",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8f0",
    theme_color: "#e0791f",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
