import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Today is the home screen now. Signing in lands here, and here answers the
 * only question that matters on open: what should I do today?
 */
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    throw redirect({ to: "/today" });
  },
  component: () => null,
});
