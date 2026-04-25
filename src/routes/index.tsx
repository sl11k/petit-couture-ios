import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "@/components/HomeScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maisonnét — Luxury Children's Fashion Boutique" },
      {
        name: "description",
        content:
          "Maisonnét — a curated luxury boutique of designer children's fashion. Elegant dresses, shoes, and gifts for baby, girl, and boy.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <HomeScreen />;
}
