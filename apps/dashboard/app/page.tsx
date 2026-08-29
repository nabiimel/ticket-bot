import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  if (session?.user && !session.error) redirect("/dashboard");

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-2xl shadow-card">
        🎫
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Ticket Bot Dashboard
        </h1>
        <p className="mx-auto max-w-md text-dim">
          Configure ticket panels, categories, forms, and staff settings for
          your Discord server — with a live preview of every message.
        </p>
      </div>
      {searchParams.error === "session-expired" && (
        <p className="rounded-lg bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
          Your session expired — please sign in again.
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/dashboard" });
        }}
      >
        <button className="btn-primary px-5 py-2.5" type="submit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4.4A19 19 0 0 0 15.3 3l-.3.5a14 14 0 0 1 4 2A16 16 0 0 0 4.8 5.4a14 14 0 0 1 4-2L8.6 3A19 19 0 0 0 4 4.4C1.6 8 1 11.6 1.2 15.1A19 19 0 0 0 7 18l.9-1.4c-.9-.3-1.7-.7-2.4-1.2l.5-.4a13.6 13.6 0 0 0 11.8 0l.5.4c-.7.5-1.5.9-2.4 1.2L16 18a19 19 0 0 0 5.8-2.9c.4-4-.6-7.6-1.8-10.7ZM8.7 13c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6.6 0c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z" />
          </svg>
          Sign in with Discord
        </button>
      </form>
    </main>
  );
}
