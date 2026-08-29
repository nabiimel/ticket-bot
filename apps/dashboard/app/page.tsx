import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  {
    title: "Visual panel builder",
    body: "Design the buttons, dropdowns and embeds people click to open a ticket — with a live preview.",
  },
  {
    title: "Categories & forms",
    body: "Give each ticket type its own staff roles, intake form, channel naming and welcome message.",
  },
  {
    title: "Transcripts & ratings",
    body: "Every closed ticket is archived as an HTML transcript, with optional post-close feedback.",
  },
  {
    title: "Snippets & automation",
    body: "Save canned replies with images, auto-close idle tickets, blacklist abusers, track metrics.",
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  if (session?.user && !session.error) redirect("/dashboard");

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo-256.png"
            alt=""
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="text-sm font-semibold tracking-tight">
            Ticket Bot
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Ticket Bot"
            width={96}
            height={96}
            priority
            className="rounded-3xl shadow-card"
          />
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Your Discord ticket system,
            <br className="hidden sm:block" /> configured from the web.
          </h1>
          <p className="mt-4 max-w-xl text-balance text-dim">
            Panels, categories, forms, transcripts, snippets and staff settings
            — edited visually, live-previewed, and applied to your server
            instantly.
          </p>

          {searchParams.error === "session-expired" && (
            <p className="mt-5 rounded-lg bg-amber-500/15 px-4 py-2 text-sm text-amber-300">
              Your session expired — please sign in again.
            </p>
          )}

          <form
            className="mt-7"
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/dashboard" });
            }}
          >
            <button
              className="btn-primary px-5 py-2.5 text-[15px]"
              type="submit"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20 4.4A19 19 0 0 0 15.3 3l-.3.5a14 14 0 0 1 4 2A16 16 0 0 0 4.8 5.4a14 14 0 0 1 4-2L8.6 3A19 19 0 0 0 4 4.4C1.6 8 1 11.6 1.2 15.1A19 19 0 0 0 7 18l.9-1.4c-.9-.3-1.7-.7-2.4-1.2l.5-.4a13.6 13.6 0 0 0 11.8 0l.5.4c-.7.5-1.5.9-2.4 1.2L16 18a19 19 0 0 0 5.8-2.9c.4-4-.6-7.6-1.8-10.7ZM8.7 13c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6.6 0c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z" />
              </svg>
              Sign in with Discord
            </button>
            <p className="mt-2 text-xs text-faint">
              You&apos;ll only see servers where you have Manage Server.
            </p>
          </form>
        </div>

        <ul className="grid w-full gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="card">
              <div className="text-sm font-semibold">{f.title}</div>
              <p className="mt-1 text-sm text-dim">{f.body}</p>
            </li>
          ))}
        </ul>

        <section className="w-full border-t border-line pt-8">
          <h2 className="text-sm font-semibold">Privacy</h2>
          <p className="mt-2 max-w-2xl text-sm text-dim">
            The bot stores only what it needs to run your ticket system — server
            configuration, ticket records, form answers, transcripts of closed
            tickets, ratings and blacklist entries. Signing in to the dashboard
            uses Discord OAuth (<code>identify</code> + <code>guilds</code>) to
            show the servers you can manage. We don&apos;t sell your data, share
            it for advertising, or run trackers. Server managers can delete
            their data in the dashboard; anyone can request access or deletion
            by contacting <span className="font-medium text-ink">ayban</span> on
            Discord.
          </p>
          <Link
            href="/privacy"
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            Read the full Privacy Policy →
          </Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-faint">
        Built by <span className="font-medium text-dim">ayban</span> ·{" "}
        <Link href="/privacy" className="hover:text-dim">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:text-dim">
          Terms
        </Link>
      </footer>
    </div>
  );
}
