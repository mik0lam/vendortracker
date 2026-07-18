import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Owner id used when auth is not configured (local development). */
export const LOCAL_OWNER_ID = "local";

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function requireUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Authentication must be configured in production.");
    }
    return null;
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Current account's owner id; redirects to /login when signed out. */
export async function requireOwnerId(): Promise<string> {
  const user = await requireUser();
  return user?.id ?? LOCAL_OWNER_ID;
}

/** Owner id for read-only page rendering (middleware already gates access). */
export async function getOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  return user?.id ?? LOCAL_OWNER_ID;
}
