"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_WELCOME_EMBED,
  QUICK_EMOJI,
  isValidEmoji,
  type CategoryConfig,
} from "@ticketbot/shared";
import { EmbedEditor } from "./EmbedEditor";
import { EmbedPreview } from "./EmbedPreview";
import { FormFieldsBuilder } from "./FormFieldsBuilder";
import { MultiSelect } from "./MultiSelect";
import { Combobox } from "./Combobox";
import {
  deleteCategory,
  saveCategory,
} from "@/app/dashboard/[guildId]/actions";
import { useUnsavedChanges } from "@/lib/dirty-store";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { StickySaveBar } from "./StickySaveBar";

type Opt = { id: string; name: string };

export function CategoryEditor({
  guildId,
  category,
  roles,
  parents,
}: {
  guildId: string;
  category: CategoryConfig;
  roles: Opt[];
  parents: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const [c, setC] = useState<CategoryConfig>(category);
  const [useWelcome, setUseWelcome] = useState(!!category.welcomeEmbed);
  const [emojiError, setEmojiError] = useState<string | null>(null);

  const dirty =
    JSON.stringify(c) !== JSON.stringify(category) ||
    useWelcome !== !!category.welcomeEmbed;
  useUnsavedChanges(dirty);

  const discard = () => {
    setC(category);
    setUseWelcome(!!category.welcomeEmbed);
    setEmojiError(null);
  };

  const patch = (p: Partial<CategoryConfig>) =>
    setC((prev) => ({ ...prev, ...p }));

  // {form.<key>} tokens for this category's fields, for the welcome editor.
  const formPlaceholders = [
    ...c.form
      .filter((f) => f.key)
      .map((f) => ({
        token: `{form.${f.key}}`,
        description: `Answer to “${f.label}”`,
      })),
    ...(c.form.length > 0
      ? [{ token: "{form.all}", description: "All answers as a list" }]
      : []),
  ];
  const formPreviewContext = Object.fromEntries([
    ...c.form
      .filter((f) => f.key)
      .map((f) => [`form.${f.key}`, `<${f.label}>`] as const),
    ["form.all", c.form.map((f) => `**${f.label}:** <answer>`).join("\n")],
  ]);

  const save = () => {
    if (c.emoji && !isValidEmoji(c.emoji)) {
      setEmojiError("Use a single emoji or a custom emoji like <:name:id>");
      return;
    }
    setEmojiError(null);
    start(async () => {
      const res = await saveCategory(guildId, category.id, {
        key: c.key,
        label: c.label,
        emoji: c.emoji,
        description: c.description,
        staffRoleIds: c.staffRoleIds,
        pingRoleIds: c.pingRoleIds,
        discordParentId: c.discordParentId,
        perUserLimit: c.perUserLimit,
        namingScheme: c.namingScheme,
        disabled: c.disabled,
        disabledReason: c.disabled ? c.disabledReason : null,
        welcomeEmbed: useWelcome
          ? (c.welcomeEmbed ?? DEFAULT_WELCOME_EMBED)
          : null,
        form: c.form,
      });
      if (res.ok) toast.success("Category saved");
      else toast.error(res.error ?? "Couldn't save category");
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete category “${category.label}”?`,
      message:
        "Its panels lose this option. Open tickets in this category are not affected.",
      confirmLabel: "Delete category",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      await deleteCategory(guildId, category.id);
      router.push(`/dashboard/${guildId}/categories`);
    });
  };

  return (
    <div className="space-y-6">
      <div
        className={`card ${
          c.disabled ? "border-[var(--warn-border)] bg-[var(--warn-soft)]" : ""
        }`}
      >
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={c.disabled}
            onChange={(e) => patch({ disabled: e.target.checked })}
          />
          Pause this ticket type
        </label>
        <p className="mt-1 text-xs text-faint">
          The panel button is greyed out and new tickets are refused. Nothing is
          deleted; open tickets are unaffected.
        </p>
        {c.disabled && (
          <input
            className="input mt-3"
            placeholder="Reason shown to members (optional) — e.g. “Back Monday”"
            value={c.disabledReason ?? ""}
            onChange={(e) => patch({ disabledReason: e.target.value || null })}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Display name</label>
          <input
            className="input"
            value={c.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
          <p className="mt-1 text-xs text-faint">
            Shown on the panel button / dropdown.
          </p>
        </div>
        <div>
          <label className="label">Reference ID</label>
          <input
            className="input"
            value={c.key}
            onChange={(e) =>
              patch({
                key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
              })
            }
          />
          <p className="mt-1 text-xs text-faint">
            Lowercase, no spaces. Used in <code>{"{form.…}"}</code> tokens,
            channel names and commands. Hard to change later.
          </p>
        </div>
        <div>
          <label className="label">Button emoji</label>
          <input
            className={emojiError ? "input input-invalid" : "input"}
            value={c.emoji ?? ""}
            placeholder="🎫 or <:name:id>"
            onChange={(e) => {
              setEmojiError(null);
              patch({ emoji: e.target.value || null });
            }}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {QUICK_EMOJI.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  setEmojiError(null);
                  patch({ emoji: em });
                }}
                className="rounded border border-line-strong px-1.5 py-0.5 text-sm hover:bg-surface-2"
              >
                {em}
              </button>
            ))}
          </div>
          {emojiError && (
            <p className="mt-1 text-xs text-danger">{emojiError}</p>
          )}
        </div>
        <div>
          <label className="label">Max open of this type per person</label>
          <input
            type="number"
            min={1}
            max={25}
            className="input"
            value={c.perUserLimit ?? ""}
            onChange={(e) =>
              patch({
                perUserLimit: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <p className="mt-1 text-xs text-faint">
            Blank = use the server limit.
          </p>
        </div>
        <div>
          <label className="label">Channel name pattern</label>
          <input
            className="input"
            placeholder={`${c.key}-{number}`}
            value={c.namingScheme ?? ""}
            onChange={(e) => patch({ namingScheme: e.target.value || null })}
          />
          <p className="mt-1 text-xs text-faint">
            Blank = use the server pattern. Tokens: <code>{"{number}"}</code>{" "}
            <code>{"{category}"}</code> <code>{"{user}"}</code>{" "}
            <code>{"{id}"}</code>{" "}
            <code>
              {"{form."}
              {c.form[0]?.key || "key"}
              {"}"}
            </code>
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Dropdown description</label>
          <input
            className="input"
            value={c.description ?? ""}
            onChange={(e) => patch({ description: e.target.value || null })}
          />
          <p className="mt-1 text-xs text-faint">
            Only shown on dropdown-style panels. Supports{" "}
            <code>{"{guild.name}"}</code> <code>{"{category.name}"}</code> (seen
            by everyone, so no per-user tokens).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Who handles these tickets</label>
          <MultiSelect
            options={roles}
            selected={c.staffRoleIds}
            onChange={(ids) => patch({ staffRoleIds: ids })}
          />
        </div>
        <div>
          <label className="label">Also notify these roles on open</label>
          <MultiSelect
            options={roles}
            selected={c.pingRoleIds}
            onChange={(ids) => patch({ pingRoleIds: ids })}
          />
        </div>
      </div>

      <div>
        <label className="label">Put ticket channels under</label>
        <Combobox
          options={parents}
          value={c.discordParentId}
          onChange={(id) => patch({ discordParentId: id })}
        />
        <p className="mt-1 text-xs text-faint">
          A Discord category — the grey folder in the channel sidebar.
        </p>
      </div>

      {/* Questions members answer to open a ticket */}
      <FormFieldsBuilder
        fields={c.form}
        onChange={(form) => patch({ form })}
        categoryLabel={c.label}
      />

      {/* Welcome override */}
      <div className="card space-y-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={useWelcome}
            onChange={(e) => setUseWelcome(e.target.checked)}
          />
          Use a custom welcome message for this ticket type
        </label>
        {useWelcome && (
          <div className="grid gap-6 lg:grid-cols-2">
            <EmbedEditor
              value={c.welcomeEmbed ?? DEFAULT_WELCOME_EMBED}
              onChange={(next) => patch({ welcomeEmbed: next })}
              guildId={guildId}
              extraPlaceholders={formPlaceholders}
            />
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="mb-2 text-xs font-semibold uppercase text-faint">
                Preview
              </div>
              <EmbedPreview
                embed={c.welcomeEmbed ?? DEFAULT_WELCOME_EMBED}
                extraContext={formPreviewContext}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save category"}
        </button>
        <button
          className="btn-danger ml-auto"
          onClick={() => void remove()}
          disabled={pending}
        >
          Delete
        </button>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={pending}
        onSave={save}
        onDiscard={discard}
      />
    </div>
  );
}
