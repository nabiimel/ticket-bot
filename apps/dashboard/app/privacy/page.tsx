import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Privacy Policy · Ticket Bot",
  description:
    "What the Ticket Bot and its dashboard collect, and how it's handled.",
};

const UPDATED = "30 August 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-9 text-lg font-semibold tracking-tight">{children}</h2>
  );
}

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-1.5 text-sm text-faint">Last updated: {UPDATED}</p>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-dim">
          <p>
            This policy explains what data the <strong>Ticket Bot</strong>{" "}
            Discord bot and its dashboard (<code>gakuticket.duckdns.org</code>)
            collect, why, and how it is handled. By adding the bot to a server
            or signing in to the dashboard, you agree to this policy.
          </p>

          <H2>Who runs this</H2>
          <p>
            Ticket Bot is an independent project operated by{" "}
            <strong>ayban</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;). It is
            not affiliated with Discord Inc.
          </p>

          <H2>What we store</H2>
          <p className="font-medium text-ink">
            When the bot is in your server:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Server ID, name and icon.</li>
            <li>
              Configuration you create: ticket categories, panels, embeds,
              messages, snippets, channel/role selections and settings.
            </li>
            <li>
              For each ticket: the opener&apos;s Discord user ID, the channel
              ID, timestamps, the staff member who claimed or closed it, and the
              close reason.
            </li>
            <li>Answers submitted to ticket intake forms.</li>
            <li>
              <strong>Transcripts</strong> — when a ticket is closed, an HTML
              copy of that channel&apos;s messages is generated. It includes
              message content, attachments, and the display names and user IDs
              of everyone who posted in the ticket.
            </li>
            <li>
              Ratings and any optional comment left after a ticket closes.
            </li>
            <li>
              Blacklist entries: the blocked user&apos;s ID, the reason, and who
              added it.
            </li>
            <li>
              An audit log of dashboard changes: the acting user&apos;s ID, the
              action, and a short summary.
            </li>
            <li>Images you upload in the dashboard, stored on our server.</li>
          </ul>

          <p className="font-medium text-ink">
            When you sign in to the dashboard (Discord OAuth,{" "}
            <code>identify</code> + <code>guilds</code> scopes):
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your Discord user ID, username and avatar.</li>
            <li>
              The list of servers you are in — used only to show which ones you
              can manage. It is cached briefly and not stored long-term.
            </li>
            <li>
              A session token is kept in a cookie in your browser. It is not
              stored on our servers.
            </li>
          </ul>

          <p>
            <span className="font-medium text-ink">Operational logs</span> may
            briefly contain server or user IDs for debugging. If an
            error-reporting webhook is configured, error messages (which may
            include those IDs) are sent to a private channel controlled by the
            operator.
          </p>

          <H2>What we do NOT do</H2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>We do not sell or rent your data.</li>
            <li>
              We do not share it with third parties for advertising or
              analytics.
            </li>
            <li>There are no ads, trackers or analytics scripts.</li>
            <li>
              We do not read or store messages from channels other than ticket
              channels, and only when a transcript is generated.
            </li>
          </ul>

          <H2>Third parties</H2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Discord</strong> — the platform the bot runs on; their{" "}
              <a
                className="text-accent hover:underline"
                href="https://discord.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Privacy Policy
              </a>{" "}
              applies to the underlying service.
            </li>
            <li>
              <strong>Hosting</strong> — the bot, dashboard and database run on
              a private server. Data is not accessible to other tenants.
            </li>
            <li>
              <strong>Backups</strong> — backups of the database may be stored
              with an S3-compatible provider if the operator has configured one.
            </li>
          </ul>

          <H2>How long we keep it</H2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Transcripts</strong> are deleted automatically according
              to the retention period each server sets (0 = kept until deleted
              manually or purged on request).
            </li>
            <li>
              <strong>Configuration and ticket records</strong> are kept while
              the bot is in your server, and remain after the bot is removed
              unless you request deletion.
            </li>
            <li>
              <strong>Dashboard uploads</strong> not referenced by any config
              are cleaned up automatically.
            </li>
          </ul>

          <H2>Your choices and rights</H2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Server owners / managers</strong> can edit or delete
              categories, panels, snippets, blacklist entries and transcripts
              directly in the dashboard at any time.
            </li>
            <li>
              <strong>Anyone</strong> may request a copy of, or the deletion of,
              the personal data we hold about them (for example, transcripts of
              tickets they opened) by contacting us. We action reasonable
              requests within 30 days. Transcripts are shared records — removing
              one person&apos;s messages may require deleting the whole
              transcript.
            </li>
            <li>
              Removing the bot from a server stops all new data collection for
              that server. To also erase existing data, contact us.
            </li>
          </ul>

          <H2>Children</H2>
          <p>
            The bot is not directed at anyone under 13, or under the minimum age
            of digital consent in their country. Discord&apos;s Terms of Service
            already require users to meet these ages.
          </p>

          <H2>Changes</H2>
          <p>
            We may update this policy. Material changes will be noted by
            updating the date above. Continued use after a change means you
            accept the revised policy.
          </p>

          <H2>Contact</H2>
          <p>
            Data requests and questions: <strong>ayban</strong> on Discord, or
            via the support server listed on the bot&apos;s top.gg page.
          </p>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-sm">
          <Link href="/" className="text-accent hover:underline">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
