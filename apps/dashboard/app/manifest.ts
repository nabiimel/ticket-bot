import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ticket Bot Dashboard",
    short_name: "Ticket Bot",
    description: "Configure your Discord ticket system.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d0e12",
    theme_color: "#5865f2",
    icons: [
      { src: "/logo-256.png", sizes: "256x256", type: "image/png" },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
