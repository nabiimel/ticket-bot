import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Terms of Service · Ticket Bot",
  description: "The terms that govern use of the Ticket Bot and its dashboard.",
};

const UPDATED = "30 August 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-9 text-lg font-semibold tracking-tight">{children}</h2>
  );
}

export default function TermsPage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-256.png"
            alt=""
            width={26}
            height={26}
            className="rounded-lg"
          />
          <span className="text-sm font-semibold tracking-tight">
            Ticket Bot
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-1.5 text-sm text-faint">Last updated: {UPDATED}</p>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-dim">
          <p>
            These terms govern your use of the <strong>Ticket Bot</strong>{" "}
            Discord bot and its dashboard (<code>gakuticket.duckdns.org</code>).
            By adding the bot to a server, or by signing in to the dashboard,
            you agree to these terms and to the{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>

          <H2>Who runs this</H2>
          <p>
            Ticket Bot is a free, independent project operated by{" "}
            <strong>ayban</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;). It is
            not affiliated with, endorsed by, or sponsored by Discord Inc. Your
            use of Discord is also governed by Discord&apos;s Terms of Service.
          </p>

          <H2>The service</H2>
          <p>
            Ticket Bot lets a Discord server run a support-ticket system —
            panels, ticket channels, intake forms, claiming and closing,
            transcripts, ratings, canned replies and related settings —
            configured through a web dashboard. Features may be added, changed
            or removed at any time.
          </p>

          <H2>Eligibility</H2>
          <p>
            You must be at least 13 years old, or the minimum age of digital
            consent in your country, and old enough to use Discord under its
            terms. If you add the bot to a server, you confirm you have
            permission to manage that server (the &ldquo;Manage Server&rdquo;
            permission or ownership).
          </p>

          <H2>Acceptable use</H2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              use the bot to store, transmit or facilitate content that is
              illegal, or that violates Discord&apos;s Terms of Service or
              Community Guidelines;
            </li>
            <li>
              attempt to disrupt, overload, reverse-engineer, or gain
              unauthorised access to the bot, the dashboard, the server it runs
              on, or other servers&apos; data;
            </li>
            <li>
              use automated means to hammer the dashboard or the bot&apos;s
              commands beyond normal use;
            </li>
            <li>resell, sublicense or present the service as your own;</li>
            <li>use the service to harass, expose or harm others.</li>
          </ul>

          <H2>Your responsibilities as a server manager</H2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              You decide how the bot is configured on your server and are
              responsible for those choices, including which channels and roles
              it can access and what your intake forms ask.
            </li>
            <li>
              You are responsible for telling your members how ticket data
              (including transcripts) is used on your server, and for having any
              legal basis required to collect it.
            </li>
            <li>
              You are responsible for the conduct of your staff who use the bot.
            </li>
          </ul>

          <H2>Availability</H2>
          <p>
            The service is provided free of charge, &ldquo;as is&rdquo; and
            &ldquo;as available&rdquo;, with no guaranteed uptime. It may be
            unavailable, interrupted, or discontinued in whole or in part at any
            time, with or without notice. We may perform maintenance, impose
            rate limits, or cap resource usage to keep the service stable for
            everyone.
          </p>

          <H2>Suspension and termination</H2>
          <p>
            We may suspend or block a server&apos;s access to the bot, or remove
            the bot from a server, if we reasonably believe it is being used in
            breach of these terms, is abusing the service, or is putting the
            service at risk for others. A suspended server&apos;s dashboard
            becomes read-only and its tickets stop functioning until the
            suspension is lifted. You may stop using the service at any time by
            removing the bot from your server.
          </p>

          <H2>No warranty</H2>
          <p>
            The service is provided without warranties of any kind, express or
            implied, including fitness for a particular purpose, reliability, or
            that it will be error-free or uninterrupted. Transcripts and other
            stored data may be lost — keep your own copies of anything
            important.
          </p>

          <H2>Limitation of liability</H2>
          <p>
            To the maximum extent permitted by law, we are not liable for any
            indirect, incidental or consequential damages, or for loss of data,
            profits or goodwill, arising from your use of or inability to use
            the service. Because the service is free, our total liability for
            any claim relating to it is limited to zero.
          </p>

          <H2>Changes to these terms</H2>
          <p>
            We may update these terms. Material changes will be noted by
            updating the date above. Continued use after a change means you
            accept the revised terms.
          </p>

          <H2>Governing law</H2>
          <p>
            These terms are governed by the laws applicable where the operator
            resides, without regard to conflict-of-law rules. Nothing here
            removes consumer rights you have under your local law that cannot be
            waived.
          </p>

          <H2>Contact</H2>
          <p>
            Questions about these terms: <strong>ayban</strong> on Discord, or
            via the support server listed on the bot&apos;s top.gg page.
          </p>
        </div>

        <div className="mt-10 flex gap-4 border-t border-line pt-6 text-sm">
          <Link href="/" className="text-accent hover:underline">
            ← Back to home
          </Link>
          <Link href="/privacy" className="text-dim hover:text-ink">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
