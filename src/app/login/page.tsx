import { AuthForm } from "@/components/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div>
        {!configured ? (
          <div className="mb-4 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Authentication is ready but not connected. Add the Supabase
            environment variables from <code>.env.example</code> to activate
            accounts.
          </div>
        ) : null}
        <AuthForm />
      </div>
    </main>
  );
}
