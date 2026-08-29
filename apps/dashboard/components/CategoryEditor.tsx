"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_WELCOME_EMBED,
  QUICK_EMOJI,
  isValidEmoji,
  type CategoryConfig,
  type FormField,
} from "@ticketbot/shared";
import { EmbedEditor } from "./EmbedEditor";
import { EmbedPreview } from "./EmbedPreview";
import { MultiSelect } from "./MultiSelect";
import { Combobox } from "./Combobox";
import {
  deleteCategory,
  saveCategory,
} from "@/app/dashboard/[guildId]/actions";
import { useUnsavedChanges } from "@/lib/dirty-store";
import { useToast } from "./Toast";

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
  const [c, setC] = useState<CategoryConfig>(category);
  const [useWelcome, setUseWelcome] = useState(!!category.welcomeEmbed);
  const [emojiError, setEmojiError] = useState<string | null>(null);

  useUnsavedChanges(
    JSON.stringify(c) !== JSON.stringify(category) ||
      useWelcome !== !!category.welcomeEmbed,
  );

  const patch = (p: Partial<CategoryConfig>) =>
    setC((prev) => ({ ...prev, ...p }));

  const setField = (i: number, p: Partial<FormField>) =>
    patch({ form: c.form.map((f, idx) => (idx === i ? { ...f, ...p } : f)) });

  const addField = () =>
    patch({
      form: [
        ...c.form,
        {
          key: `field_${c.form.length + 1}`,
          label: "New field",
          style: "short",
          required: false,
        },
      ],
    });

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
        welcomeEmbed: useWelcome
          ? (c.welcomeEmbed ?? DEFAULT_WELCOME_EMBED)
          : null,
        form: c.form,
      });
      if (res.ok) toast.success("Category saved");
      else toast.error(res.error ?? "Couldn't save category");
    });
  };

  const remove = () =>
    start(async () => {
      await deleteCategory(guildId, category.id);
      router.push(`/dashboard/${guildId}/categories`);
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Label</label>
          <input
            className="input"
            value={c.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Key</label>
          <input
            className="input"
            value={c.key}
            onChange={(e) =>
              patch({
                key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
              })
            }
          />
        </div>
        <div>
          <label className="label">Emoji</label>
          <input
            className={emojiError ? "input border-red-500" : "input"}
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
            <p className="mt-1 text-xs text-red-400">{emojiError}</p>
          )}
        </div>
        <div>
          <label className="label">
            Per-user open limit (blank = server default)
          </label>
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
        </div>
        <div>
          <label className="label">
            Channel naming (blank = server default)
          </label>
          <input
            className="input"
            placeholder={`${c.key}-{number}`}
            value={c.namingScheme ?? ""}
            onChange={(e) => patch({ namingScheme: e.target.value || null })}
          />
          <p className="mt-1 text-xs text-faint">
            Tokens: <code>{"{number}"}</code> <code>{"{category}"}</code>{" "}
            <code>{"{user}"}</code> <code>{"{id}"}</code>{" "}
            <code>
              {"{form."}
              {c.form[0]?.key || "key"}
              {"}"}
            </code>
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Menu description</label>
          <input
            className="input"
            value={c.description ?? ""}
            onChange={(e) => patch({ description: e.target.value || null })}
          />
          <p className="mt-1 text-xs text-faint">
            Supports <code>{"{guild.name}"}</code>{" "}
            <code>{"{category.name}"}</code> (shown to everyone, so no per-user
            tokens here).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Staff roles</label>
          <MultiSelect
            options={roles}
            selected={c.staffRoleIds}
            onChange={(ids) => patch({ staffRoleIds: ids })}
          />
        </div>
        <div>
          <label className="label">Ping roles on open</label>
          <MultiSelect
            options={roles}
            selected={c.pingRoleIds}
            onChange={(ids) => patch({ pingRoleIds: ids })}
          />
        </div>
      </div>

      <div>
        <label className="label">Parent Discord category</label>
        <Combobox
          options={parents}
          value={c.discordParentId}
          onChange={(id) => patch({ discordParentId: id })}
        />
      </div>

      {/* Form builder */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Open form ({c.form.length}/5)</h2>
          <button
            className="btn-secondary"
            onClick={addField}
            disabled={c.form.length >= 5}
          >
            Add field
          </button>
        </div>
        {c.form.length === 0 && (
          <p className="text-sm text-faint">
            No form — tickets open immediately.
          </p>
        )}
        {c.form.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 rounded-md border border-line p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
          >
            <input
              className="input"
              placeholder="Label"
              value={f.label}
              onChange={(e) => setField(i, { label: e.target.value })}
            />
            <input
              className="input"
              placeholder="key"
              value={f.key}
              onChange={(e) =>
                setField(i, {
                  key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                })
              }
            />
            <select
              className="input"
              value={f.style}
              onChange={(e) =>
                setField(i, { style: e.target.value as FormField["style"] })
              }
            >
              <option value="short">short</option>
              <option value="paragraph">paragraph</option>
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => setField(i, { required: e.target.checked })}
              />
              req
            </label>
            <button
              className="text-xs text-discord-red hover:underline"
              onClick={() =>
                patch({ form: c.form.filter((_, idx) => idx !== i) })
              }
            >
              remove
            </button>
          </div>
        ))}
        {c.form.length > 0 && (
          <p className="text-xs text-faint">
            Reference an answer in the welcome message as{" "}
            <code className="text-discord-blurple">
              {"{form."}
              {c.form[0]?.key || "key"}
              {"}"}
            </code>
            , or drop them all in with{" "}
            <code className="text-discord-blurple">{"{form.all}"}</code>.
          </p>
        )}
      </div>

      {/* Welcome override */}
      <div className="card space-y-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={useWelcome}
            onChange={(e) => setUseWelcome(e.target.checked)}
          />
          Override welcome message for this category
        </label>
        {useWelcome && (
          <div className="grid gap-6 lg:grid-cols-2">
            <EmbedEditor
              value={c.welcomeEmbed ?? DEFAULT_WELCOME_EMBED}
              onChange={(next) => patch({ welcomeEmbed: next })}
              guildId={guildId}
              extraPlaceholders={formPlaceholders}
            />
            <div>
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
          onClick={remove}
          disabled={pending}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
