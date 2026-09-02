"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { SUPPORTED_LANGUAGES, type GuildConfig } from "@ticketbot/shared";
import { emptyFormState, type FormState } from "@/lib/form";
import { saveGeneral } from "@/app/dashboard/[guildId]/actions";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FormFeedback";
import { FormToast } from "./FormToast";
import { Combobox } from "./Combobox";
import { useUnsavedChanges } from "@/lib/dirty-store";

type Opt = { id: string; name: string };

function inputCls(state: FormState, name: string): string {
  return state?.fieldErrors?.[name] ? "input input-invalid" : "input";
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// A short, opinionated list; the guild's own tz is added if it's not here.
const STAFF_TZ = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const minToHM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(
    2,
    "0",
  )}`;

export function GeneralForm({
  guildId,
  cfg,
  roles,
  textChannels,
  categoryChannels,
}: {
  guildId: string;
  cfg: GuildConfig;
  roles: Opt[];
  textChannels: Opt[];
  categoryChannels: Opt[];
}) {
  const [state, formAction] = useFormState(
    saveGeneral.bind(null, guildId),
    emptyFormState,
  );

  // Combobox fields need local state (they submit via hidden inputs).
  const [logChannelId, setLog] = useState(cfg.logChannelId);
  const [transcriptChannelId, setTranscript] = useState(
    cfg.transcriptChannelId,
  );
  const [defaultStaffRoleId, setStaff] = useState(cfg.defaultStaffRoleId);
  const [archiveCategoryId, setArchive] = useState(cfg.archiveCategoryId);
  const [dirty, setDirty] = useState(false);

  useUnsavedChanges(dirty);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  const combo = (setter: (v: string | null) => void) => (v: string | null) => {
    setter(v);
    setDirty(true);
  };

  return (
    <form
      action={formAction}
      onInput={() => setDirty(true)}
      className="space-y-8"
    >
      <FormToast state={state} />

      <section className="space-y-5">
        <h2 className="text-sm font-semibold text-dim">Channels</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Log channel</label>
            <Combobox
              name="logChannelId"
              options={textChannels}
              value={logChannelId}
              onChange={combo(setLog)}
              invalid={!!state?.fieldErrors?.logChannelId}
            />
            <p className="mt-1 text-xs text-faint">
              Ticket opens, claims and closes are logged here (staff-only).
            </p>
            <FieldError state={state} name="logChannelId" />
          </div>
          <div>
            <label className="label">Transcript channel</label>
            <Combobox
              name="transcriptChannelId"
              options={textChannels}
              value={transcriptChannelId}
              onChange={combo(setTranscript)}
              invalid={!!state?.fieldErrors?.transcriptChannelId}
            />
            <p className="mt-1 text-xs text-faint">
              A copy of each closed ticket&apos;s transcript is posted here.
            </p>
            <FieldError state={state} name="transcriptChannelId" />
          </div>
        </div>

        <div>
          <label className="label">Default staff role</label>
          <Combobox
            name="defaultStaffRoleId"
            options={roles}
            value={defaultStaffRoleId}
            onChange={combo(setStaff)}
            invalid={!!state?.fieldErrors?.defaultStaffRoleId}
          />
          <p className="mt-1 text-xs text-faint">
            Can see every ticket unless a ticket type sets its own staff roles.
          </p>
          <FieldError state={state} name="defaultStaffRoleId" />
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-semibold text-dim">Behaviour</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Language</label>
            <select
              name="language"
              defaultValue={cfg.language}
              className="input"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <FieldError state={state} name="language" />
          </div>
          <div>
            <label className="label">Max open tickets per person</label>
            <input
              type="number"
              name="maxOpenPerUser"
              min={1}
              max={25}
              defaultValue={cfg.maxOpenPerUser}
              className={inputCls(state, "maxOpenPerUser")}
            />
            <p className="mt-1 text-xs text-faint">Counted across all types.</p>
            <FieldError state={state} name="maxOpenPerUser" />
          </div>
        </div>

        <div>
          <label className="label">Ticket channel name</label>
          <input
            name="namingScheme"
            defaultValue={cfg.namingScheme}
            className={inputCls(state, "namingScheme")}
            placeholder="ticket-{number}"
          />
          <p className="mt-1 text-xs text-faint">
            Pattern for new channels. Must include <code>{"{number}"}</code> or{" "}
            <code>{"{id}"}</code>. Other tokens: <code>{"{category}"}</code>{" "}
            <code>{"{user}"}</code> <code>{"{form.<key>}"}</code>. Each ticket
            type can override this.
          </p>
          <FieldError state={state} name="namingScheme" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">When a ticket closes</label>
            <select
              name="closeBehaviour"
              defaultValue={cfg.closeBehaviour}
              className="input"
            >
              <option value="delete">Delete the channel</option>
              <option value="archive">Move it to an archive category</option>
            </select>
          </div>
          <div>
            <label className="label">Archive category</label>
            <Combobox
              name="archiveCategoryId"
              options={categoryChannels}
              value={archiveCategoryId}
              onChange={combo(setArchive)}
              invalid={!!state?.fieldErrors?.archiveCategoryId}
            />
            <p className="mt-1 text-xs text-faint">
              Only used when close is set to &ldquo;move&rdquo;.
            </p>
            <FieldError state={state} name="archiveCategoryId" />
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="feedbackEnabled"
              defaultChecked={cfg.feedbackEnabled}
            />
            Ask the opener for a rating after closing
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="claimingEnabled"
              defaultChecked={cfg.claimingEnabled}
            />
            Let staff claim tickets
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-semibold text-dim">Response targets</h2>
        <p className="-mt-3 text-xs text-faint">
          A ticket past either target is flagged on the Overview, Tickets
          console and in Notifications.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Claim within (minutes)</label>
            <input
              type="number"
              name="slaUnclaimedMins"
              min={1}
              max={1440}
              defaultValue={cfg.slaUnclaimedMins}
              className={inputCls(state, "slaUnclaimedMins")}
            />
            <p className="mt-1 text-xs text-faint">
              Only counts while claiming is on.
            </p>
            <FieldError state={state} name="slaUnclaimedMins" />
          </div>
          <div>
            <label className="label">First reply within (minutes)</label>
            <input
              type="number"
              name="slaNoReplyMins"
              min={1}
              max={1440}
              defaultValue={cfg.slaNoReplyMins}
              className={inputCls(state, "slaNoReplyMins")}
            />
            <FieldError state={state} name="slaNoReplyMins" />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-semibold text-dim">Staff hours</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="staffStatusEnabled"
            defaultChecked={cfg.staffStatusEnabled}
          />
          Show a live <strong>Staff online / offline</strong> line on published
          panels
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Timezone</label>
            <select
              name="staffTz"
              defaultValue={cfg.staffHours?.tz ?? "UTC"}
              className="input"
            >
              {STAFF_TZ.includes(cfg.staffHours?.tz ?? "") ||
              !cfg.staffHours?.tz ? null : (
                <option value={cfg.staffHours.tz}>{cfg.staffHours.tz}</option>
              )}
              {STAFF_TZ.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Right now</label>
            <select
              name="staffOverride"
              defaultValue={cfg.staffStatusOverride}
              className="input"
            >
              <option value="auto">Follow the hours below</option>
              <option value="open">Force “online”</option>
              <option value="closed">Force “offline”</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          {DAY_NAMES.map((name, d) => {
            const w = cfg.staffHours?.days?.[d];
            const on = cfg.staffHours ? !!w : d >= 1 && d <= 5;
            const from = w ? minToHM(w[0]) : "09:00";
            const to = w ? minToHM(w[1]) : "17:00";
            return (
              <div
                key={d}
                className="grid grid-cols-[7rem_auto_1fr_auto_1fr] items-center gap-2 text-sm"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`staffDay${d}Open`}
                    defaultChecked={on}
                  />
                  {name}
                </label>
                <span className="text-faint">from</span>
                <input
                  type="time"
                  name={`staffDay${d}From`}
                  defaultValue={from}
                  className="input py-1"
                />
                <span className="text-faint">to</span>
                <input
                  type="time"
                  name={`staffDay${d}To`}
                  defaultValue={to}
                  className="input py-1"
                />
              </div>
            );
          })}
        </div>
        <FieldError state={state} name="staffHours" />
        <p className="text-xs text-faint">
          Times are in the timezone above. Members can always open a ticket —
          this only sets expectations.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-semibold text-dim">Retention</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Auto-close after inactivity</label>
            <input
              type="number"
              name="inactivityHours"
              min={0}
              max={720}
              defaultValue={cfg.inactivityHours}
              className={inputCls(state, "inactivityHours")}
            />
            <p className="mt-1 text-xs text-faint">
              Hours with no new messages. 0 = never.
            </p>
            <FieldError state={state} name="inactivityHours" />
          </div>
          <div>
            <label className="label">Delete saved transcripts after</label>
            <input
              type="number"
              name="transcriptRetentionDays"
              min={0}
              max={3650}
              defaultValue={cfg.transcriptRetentionDays}
              className={inputCls(state, "transcriptRetentionDays")}
            />
            <p className="mt-1 text-xs text-faint">Days. 0 = keep forever.</p>
            <FieldError state={state} name="transcriptRetentionDays" />
          </div>
        </div>
      </section>

      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
