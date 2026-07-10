import { redirect } from "next/navigation";

/**
 * /discovery is the intuitive URL for the voice discovery session; the actual
 * flow lives at /onboarding (Meet Aria → role/language → the ConvAI session).
 * Redirect so the guessed/linked URL resolves instead of 404-ing.
 */
export default function DiscoveryRedirect() {
  redirect("/onboarding");
}
