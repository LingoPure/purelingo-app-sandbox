import { redirect } from "next/navigation";

export const metadata = {
  title: "Get started — LingoPure",
};

export default function GetStartedRedirect() {
  redirect("/signup");
}
