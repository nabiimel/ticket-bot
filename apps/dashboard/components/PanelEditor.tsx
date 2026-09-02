"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_BUTTON_CONFIG,
  PREVIEW_CONTEXT,
  renderTemplate,
  type ButtonConfig,
  type ButtonStyleName,
  type EmbedConfig,
  type FormField,
  type PanelConfig,
  type PanelStyle,
} from "@ticketbot/shared";
import { EmbedEditor } from "./EmbedEditor";
import { EmbedPreview } from "./EmbedPreview";
import { OpenFlowSimulator } from "./OpenFlowSimulator";
import { Combobox } from "./Combobox";
import {
  deletePanel,
  publishPanel,
  savePanel,
  sendTest,
} from "@/app/dashboard/[guildId]/actions";
import { useUnsavedChanges } from "@/lib/dirty-store";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { StickySaveBar } from "./StickySaveBar";

type Opt = { id: string; name: string };
type Cat = {
  id: number;
  label: string;
  emoji: string | null;
  key: string;
  form: FormField[];
  welcomeEmbed: EmbedConfig | null;
};

const STYLE_CLASSES: Record<ButtonStyleName, string> = {
  Primary: "bg-discord-blurple text-white",
  Secondary: "bg-surface-3 text-white",
  Success: "bg-discord-green text-black",
  Danger: "bg-discord-red text-white",
};

export function PanelEditor({
  guildId,
  panel,
  categories,
  textChannels,
}: {
  guildId: string;
  panel: PanelConfig;
  categories: Cat[];
  textChannels: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const [embed, setEmbed] = useState<EmbedConfig>(panel.embed);
  const [style, setStyle] = useState<PanelStyle>(panel.style);
  const [placeholder, setPlaceholder] = useState(
    panel.dropdownPlaceholder ?? "",
  );
  const [channelId, setChannelId] = useState<string | null>(panel.channelId);
  const [catIds, setCatIds] = useState<number[]>(panel.categoryIds);
  const [buttons, setButtons] = useState<Record<string, ButtonConfig>>(
    panel.buttons,
  );

  const payload = useMemo(
    () => ({
      channelId: channelId || null,
      style,
      dropdownPlaceholder: placeholder || null,
      embed,
      buttons,
      categoryIds: catIds,
    }),
    [channelId, style, placeholder, embed, buttons, catIds],
  );

  const pristine = {
    channelId: panel.channelId || null,
    style: panel.style,
    dropdownPlaceholder: panel.dropdownPlaceholder || null,
    embed: panel.embed,
    buttons: panel.buttons,
    categoryIds: panel.categoryIds,
  };
  const dirty = JSON.stringify(payload) !== JSON.stringify(pristine);
  useUnsavedChanges(dirty);

  const discard = () => {
    setEmbed(panel.embed);
    setStyle(panel.style);
    setPlaceholder(panel.dropdownPlaceholder ?? "");
    setChannelId(panel.channelId);
    setCatIds(panel.categoryIds);
    setButtons(panel.buttons);
  };

  const saveDraft = () =>
    run(() => savePanel(guildId, panel.id, payload), "Draft saved");

  const removePanel = async () => {
    const ok = await confirm({
      title: "Delete this panel?",
      message:
        "If it's been posted to Discord, that message is left in place — delete it manually.",
      confirmLabel: "Delete panel",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      await deletePanel(guildId, panel.id);
      router.push(`/dashboard/${guildId}/panels`);
    });
  };

  const addCat = (id: number) => setCatIds((p) => [...p, id]);
  const removeCat = (id: number) => setCatIds((p) => p.filter((x) => x !== id));
  const moveCat = (idx: number, dir: -1 | 1) =>
    setCatIds((p) => {
      const next = [...p];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return p;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });

  const setButton = (id: number, p: Partial<ButtonConfig>) =>
    setButtons((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? DEFAULT_BUTTON_CONFIG), ...p },
    }));

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Something went wrong");
    });

  const catById = (id: number) => categories.find((c) => c.id === id);
  const selected = catIds.map((id) => catById(id)).filter(Boolean) as Cat[];
  const unselected = categories.filter((c) => !catIds.includes(c.id));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <EmbedEditor value={embed} onChange={setEmbed} guildId={guildId} />
        </div>
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="text-xs font-semibold uppercase text-faint">
            Live preview
          </div>
          <EmbedPreview embed={embed} />
          {style === "dropdown" ? (
            <div className="max-w-md rounded bg-[#1e1f22] px-3 py-2 text-sm text-dim">
              {renderTemplate(placeholder, PREVIEW_CONTEXT) ||
                "Select a ticket type…"}
            </div>
          ) : (
            <div className="flex max-w-md flex-wrap gap-2">
              {selected.map((c) => {
                const b = buttons[c.id] ?? {
                  ...DEFAULT_BUTTON_CONFIG,
                  label: c.label,
                };
                return (
                  <span
                    key={c.id}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${STYLE_CLASSES[b.style]}`}
                  >
                    {(b.emoji || c.emoji) ?? ""} {b.label || c.label}
                  </span>
                );
              })}
              {selected.length === 0 && (
                <span className="text-xs text-faint">Add categories below</span>
              )}
            </div>
          )}
          <OpenFlowSimulator
            embed={embed}
            style={style}
            dropdownPlaceholder={placeholder || null}
            buttons={buttons}
            categories={selected.map((c) => ({
              id: c.id,
              key: c.key,
              label: c.label,
              emoji: c.emoji,
              form: c.form,
              welcomeEmbed: c.welcomeEmbed,
            }))}
          />
        </div>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Layout</label>
            <select
              className="input"
              value={style}
              onChange={(e) => setStyle(e.target.value as PanelStyle)}
            >
              <option value="buttons">Buttons</option>
              <option value="dropdown">Dropdown menu</option>
            </select>
          </div>
          <div>
            <label className="label">Post this panel in</label>
            <Combobox
              options={textChannels}
              value={channelId}
              onChange={setChannelId}
              placeholder="— choose —"
              allowClear={false}
            />
          </div>
        </div>

        {style === "dropdown" && (
          <div>
            <label className="label">Dropdown prompt</label>
            <input
              className="input"
              value={placeholder}
              placeholder="Choose a ticket type…"
              onChange={(e) => setPlaceholder(e.target.value)}
            />
            <p className="mt-1 text-xs text-faint">
              Supports <code>{"{guild.name}"}</code>.
            </p>
          </div>
        )}

        <div>
          <label className="label">Ticket types on this panel</label>
          <div className="space-y-2">
            {selected.length === 0 && (
              <p className="text-sm text-faint">None added yet.</p>
            )}
            {selected.map((c, idx) => {
              const b = buttons[c.id] ?? {
                ...DEFAULT_BUTTON_CONFIG,
                label: c.label,
              };
              return (
                <div key={c.id} className="rounded-md border border-line p-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex flex-col leading-none">
                      <button
                        type="button"
                        className="px-1 text-faint hover:text-white disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => moveCat(idx, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="px-1 text-faint hover:text-white disabled:opacity-30"
                        disabled={idx === selected.length - 1}
                        onClick={() => moveCat(idx, 1)}
                      >
                        ▼
                      </button>
                    </div>
                    <span className="grow">
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.label}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-discord-red hover:underline"
                      onClick={() => removeCat(c.id)}
                    >
                      remove
                    </button>
                  </div>
                  {style === "buttons" && (
                    <div className="mt-2 grid grid-cols-[1fr_5rem_8rem] gap-2">
                      <input
                        className="input"
                        placeholder="Button text"
                        value={b.label}
                        onChange={(e) =>
                          setButton(c.id, { label: e.target.value })
                        }
                      />
                      <input
                        className="input"
                        placeholder="emoji"
                        value={b.emoji ?? ""}
                        onChange={(e) =>
                          setButton(c.id, {
                            emoji: e.target.value || undefined,
                          })
                        }
                      />
                      <select
                        className="input"
                        value={b.style}
                        onChange={(e) =>
                          setButton(c.id, {
                            style: e.target.value as ButtonStyleName,
                          })
                        }
                      >
                        <option value="Primary">Blurple</option>
                        <option value="Secondary">Grey</option>
                        <option value="Success">Green</option>
                        <option value="Danger">Red</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unselected.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-faint">Add a ticket type</div>
              <div className="flex flex-wrap gap-2">
                {unselected.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn-secondary py-1 text-xs"
                    onClick={() => addCat(c.id)}
                  >
                    + {c.emoji ? `${c.emoji} ` : ""}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {categories.length === 0 && (
            <p className="text-sm text-faint">Create categories first.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={saveDraft}
        >
          Save draft
        </button>
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const s = await savePanel(guildId, panel.id, payload);
              if (!s.ok) return s;
              return publishPanel(guildId, panel.id);
            }, "Published — panel posting to Discord")
          }
        >
          Save &amp; publish
        </button>
        <button
          className="btn-secondary"
          disabled={pending || !channelId}
          onClick={() =>
            run(() => sendTest(guildId, channelId ?? "", embed), "Test sent")
          }
        >
          Send a test copy
        </button>
        <button
          className="btn-danger ml-auto"
          disabled={pending}
          onClick={() => void removePanel()}
        >
          Delete
        </button>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={pending}
        onSave={saveDraft}
        onDiscard={discard}
        label="Unsaved draft changes"
      />
    </div>
  );
}
