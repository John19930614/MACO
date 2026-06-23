import { getProfiles, getSites } from "@/lib/data/repo";
import { SettingsClient } from "./SettingsClient";
import type { Profile, Site } from "@/lib/types";

export default async function SettingsPage() {
  let profiles: Profile[] = [];
  let sites: Site[] = [];

  try {
    [profiles, sites] = await Promise.all([getProfiles(), getSites()]);
  } catch {
    // Falls back to mock data in SettingsClient
  }

  return <SettingsClient serverProfiles={profiles} serverSites={sites} />;
}
