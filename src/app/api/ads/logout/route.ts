import { redirect } from "next/navigation";
import { clearAdvertiserSession } from "@/lib/advertiser-auth";

export async function POST() {
  await clearAdvertiserSession();
  redirect("/advertise/login");
}
