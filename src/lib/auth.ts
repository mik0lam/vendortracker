import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  isAllowedEmail,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) return null;
  return user;
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
