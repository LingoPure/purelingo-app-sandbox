import { redirect } from "next/navigation";

// Bare /investor → the investor sign-in entry (§8.5 dedicated investor path).
export default function InvestorIndex() {
  redirect("/investor/login");
}
