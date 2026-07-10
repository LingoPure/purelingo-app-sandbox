import { redirect } from "next/navigation";

/**
 * The demo CTAs route sandbox visitors straight into the working product
 * (the /demo entry → sign up → voice discovery → dashboard), so they can
 * experience the full flow we built rather than a booking form. Any lingering
 * /book-a-demo link redirects there.
 */
export default function BookADemo() {
  redirect("/demo");
}
