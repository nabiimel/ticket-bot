"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationConfig, EmbedConfig } from "@ticketbot/shared";
import {
  deleteApplication,
  publishApplication,
  saveApplication,
} from "@/app/dashboard/[guildId]/actions";
import { useUnsavedChanges } from "@/lib/dirty-store";
import { EmbedEditor } from "./EmbedEditor";
import { EmbedPreview } from "./EmbedPreview";
import { FormFieldsBuilder } from "./FormFieldsBuilder";
import { MultiSelect } from "./MultiSelect";
import { Combobox } from "./Combobox";
import { StickySaveBar } from "./StickySaveBar";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

type Opt = { id: string; name: string };

export function ApplicationEditor({
  guildId,
  app,
  roles,
  textChannels,
}: {
  guildId: string;
  app: ApplicationConfig;
  roles: Opt[];
  textChannels: Opt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const [name, setName] = useState(app.name);
  const [embed, setEmbed] = useState<EmbedConfig>(app.embed);
  const [buttonLabel, setButtonLabel] = useState(app.buttonLabel);
  const [questions, setQuestions] = useState(app.questions);
  const [reviewerRoleIds, setReviewers] = useState(app.reviewerRoleIds);
  const [grantRoleIds, setGrants] = useState(app.grantRoleIds);
  const [channelId, setChannelId] = useState(app.channelId);
  const [logChannelId, setLogChannelId] = useState(app.logChannelId);
  const [maxOpenPerUser, setMax] = useState(app.maxOpenPerUser);
  const e = app.eligibility ?? {};
  const [minAccountDays, setMinAcc] = useState(e.minAccountDays ?? "");
  const [minMemberDays, setMinMem] = useState(e.minMemberDays ?? "");
  const [requiredRoleIds, setRequired] = useState(e.requiredRoleIds ?? []);
  const [blockedRoleIds, setBlocked] = useState(e.blockedRoleIds ?? []);

  const payload = useMemo(
    () => ({
      name,
      channelId: channelId || null,
      embed,
      buttonLabel,
      questions,
      reviewerRoleIds,
      grantRoleIds,
      logChannelId: logChannelId || null,
      eligibility: {
        minAccountDays: minAccountDays ? Number(minAccountDays) : undefined,
        minMemberDays: minMemberDays ? Number(minMemberDays) : undefined,
        requiredRoleIds,
        blockedRoleIds,
      },
      maxOpenPerUser: Number(maxOpenPerUser) || 1,
    }),
    [
      name,
      channelId,
      embed,
      buttonLabel,
      questions,
      reviewerRoleIds,
      grantRoleIds,
      logChannelId,
      minAccountDays,
      minMemberDays,
      requiredRoleIds,
      blockedRoleIds,
      maxOpenPerUser,
    ],
  );

  const dirty =
    JSON.stringify(payload) !==
    JSON.stringify({
      name: app.name,
      channelId: app.channelId || null,
      embed: app.embed,
      buttonLabel: app.buttonLabel,
      questions: app.questions,
      reviewerRoleIds: app.reviewerRoleIds,
      grantRoleIds: app.grantRoleIds,
      logChannelId: app.logChannelId || null,
      eligibility: {
        minAccountDays: e.minAccountDays,
        minMemberDays: e.minMemberDays,
        requiredRoleIds: e.requiredRoleIds ?? [],
        blockedRoleIds: e.blockedRoleIds ?? [],
      },
      maxOpenPerUser: app.maxOpenPerUser,
    });
  useUnsavedChanges(dirty);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong");
    });

  const save = () =>
    run(() => saveApplication(guildId, app.id, payload), "Saved");
  const remove = async () => {
    if (
      !(await confirm({
        title: "Delete this application?",
        message: "Pending submissions are removed too.",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    start(async () => {
      await deleteApplication(guildId, app.id);
      router.push(`/dashboard/${guildId}/applications/panels`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
          />
        </div>
        <div>
          <label className="label">Button label</label>
          <input
            className="input"
            value={buttonLabel}
            onChange={(ev) => setButtonLabel(ev.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <EmbedEditor value={embed} onChange={setEmbed} guildId={guildId} />
        </div>
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="text-xs font-semibold uppercase text-faint">
            Live preview
          </div>
          <EmbedPreview embed={embed} />
        </div>
      </div>

      <FormFieldsBuilder
        fields={questions}
        onChange={setQuestions}
        categoryLabel={name}
      />

      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Post the application in</label>
          <Combobox
            options={textChannels}
            value={channelId}
            onChange={setChannelId}
          />
        </div>
        <div>
          <label className="label">Send submissions to review in</label>
          <Combobox
            options={textChannels}
            value={logChannelId}
            onChange={setLogChannelId}
          />
        </div>
        <div>
          <label className="label">Reviewers (approve / deny)</label>
          <MultiSelect
            options={roles}
            selected={reviewerRoleIds}
            onChange={setReviewers}
          />
        </div>
        <div>
          <label className="label">Roles granted on approval</label>
          <MultiSelect
            options={roles}
            selected={grantRoleIds}
            onChange={setGrants}
          />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Who can apply</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Min account age (days)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={minAccountDays}
              onChange={(ev) => setMinAcc(ev.target.value)}
            />
          </div>
          <div>
            <label className="label">Min time in server (days)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={minMemberDays}
              onChange={(ev) => setMinMem(ev.target.value)}
            />
          </div>
          <div>
            <label className="label">Max open applications / person</label>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={maxOpenPerUser}
              onChange={(ev) => setMax(Number(ev.target.value))}
            />
          </div>
          <div>
            <label className="label">Required role</label>
            <MultiSelect
              options={roles}
              selected={requiredRoleIds}
              onChange={setRequired}
            />
          </div>
          <div>
            <label className="label">Blocked roles</label>
            <MultiSelect
              options={roles}
              selected={blockedRoleIds}
              onChange={setBlocked}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secondary" disabled={pending} onClick={save}>
          Save draft
        </button>
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const s = await saveApplication(guildId, app.id, payload);
              if (!s.ok) return s;
              return publishApplication(guildId, app.id);
            }, "Published — application posting to Discord")
          }
        >
          Save &amp; publish
        </button>
        <button
          className="btn-danger ml-auto"
          disabled={pending}
          onClick={() => void remove()}
        >
          Delete
        </button>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={pending}
        onSave={save}
        label="Unsaved application changes"
      />
    </div>
  );
}
