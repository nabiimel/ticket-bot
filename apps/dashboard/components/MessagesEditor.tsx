"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_CLOSE_EMBED,
  DEFAULT_FEEDBACK_EMBED,
  DEFAULT_WELCOME_EMBED,
  type EmbedConfig,
} from "@ticketbot/shared";
import { EmbedEditor } from "./EmbedEditor";
import { EmbedPreview } from "./EmbedPreview";
import { saveMessages } from "@/app/dashboard/[guildId]/actions";
import { useUnsavedChanges } from "@/lib/dirty-store";
import { useToast } from "./Toast";
import { StickySaveBar } from "./StickySaveBar";

type Props = {
  guildId: string;
  welcome: EmbedConfig | null;
  close: EmbedConfig | null;
  feedback: EmbedConfig | null;
};

const TABS = [
  {
    key: "welcome",
    label: "Welcome (in ticket)",
    fallback: DEFAULT_WELCOME_EMBED,
  },
  { key: "close", label: "Close DM", fallback: DEFAULT_CLOSE_EMBED },
  {
    key: "feedback",
    label: "Feedback prompt",
    fallback: DEFAULT_FEEDBACK_EMBED,
  },
] as const;

export function MessagesEditor({ guildId, welcome, close, feedback }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("welcome");
  const [state, setState] = useState({
    welcome: welcome ?? DEFAULT_WELCOME_EMBED,
    close: close ?? DEFAULT_CLOSE_EMBED,
    feedback: feedback ?? DEFAULT_FEEDBACK_EMBED,
  });
  const [pending, start] = useTransition();
  const toast = useToast();

  const pristine = {
    welcome: welcome ?? DEFAULT_WELCOME_EMBED,
    close: close ?? DEFAULT_CLOSE_EMBED,
    feedback: feedback ?? DEFAULT_FEEDBACK_EMBED,
  };
  const dirty = JSON.stringify(state) !== JSON.stringify(pristine);
  useUnsavedChanges(dirty);

  const current = state[tab];
  const setCurrent = (next: EmbedConfig) =>
    setState((s) => ({ ...s, [tab]: next }));

  const save = () =>
    start(async () => {
      const res = await saveMessages(guildId, {
        welcomeEmbed: state.welcome,
        closeEmbed: state.close,
        feedbackPromptEmbed: state.feedback,
      });
      if (res.ok) toast.success("Messages saved");
      else toast.error("Couldn't save messages");
    });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm ${
              tab === t.key
                ? "border-b-2 border-discord-blurple font-medium text-white"
                : "text-dim hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <EmbedEditor
            value={current}
            onChange={setCurrent}
            guildId={guildId}
          />
        </div>
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase text-faint">
            Live preview
          </div>
          <EmbedPreview embed={current} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save all messages"}
        </button>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={pending}
        onSave={save}
        onDiscard={() => setState(pristine)}
      />
    </div>
  );
}
