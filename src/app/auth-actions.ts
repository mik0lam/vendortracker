"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
};

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." } as const;
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." } as const;
  }
  return { email, password } as const;
}

export async function signIn(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase has not been configured yet." };
  }

  const values = credentials(formData);
  if ("error" in values) return { error: values.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(values);
  if (error) return { error: error.message };

  redirect("/");
}

export async function signUp(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase has not been configured yet." };
  }

  const values = credentials(formData);
  if ("error" in values) return { error: values.error };

  const supabase = await createSupabaseServerClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const { data, error } = await supabase.auth.signUp({
    ...values,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  if (data.session) redirect("/");

  return {
    message: "Check your email to confirm the account, then sign in.",
  };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
