import { getItem, setItem } from "@/lib/secure-store";

export const ONBOARDING_DONE_KEY = "nidokey.onboarding.done";

export async function getOnboardingDone(): Promise<boolean> {
  return (await getItem(ONBOARDING_DONE_KEY)) === "1";
}

export async function setOnboardingDone(): Promise<void> {
  await setItem(ONBOARDING_DONE_KEY, "1");
}
