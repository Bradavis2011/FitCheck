import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Or This? — AI Outfit Feedback",
    short_name: "Or This?",
    description:
      "AI outfit feedback app — get an honest score and style advice before you leave.",
    start_url: "/",
    display: "browser",
    background_color: "#FFFFFF",
    theme_color: "#E85D4C",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
