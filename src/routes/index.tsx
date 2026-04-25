import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Doctor Bridge — Doctor-to-doctor referrals for India" },
      {
        name: "description",
        content:
          "A verified network of NMC-registered specialists. Search by condition, confirm availability, send clinical context — all in one thread.",
      },
    ],
  }),
  component: LandingPage,
});
