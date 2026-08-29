"use client";

import { useFormState } from "react-dom";
import { emptyFormState } from "@/lib/form";
import { createSnippetFromForm } from "@/app/dashboard/[guildId]/actions";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FormFeedback";
import { FormToast } from "./FormToast";

export function SnippetCreateForm({ guildId }: { guildId: string }) {
  const [state, formAction] = useFormState(
    createSnippetFromForm.bind(null, guildId),
    emptyFormState,
  );

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3">
      <div className="grow">
        <label className="label">Shortcut</label>
        <input
          name="name"
          className={
            state?.fieldErrors?.name
              ? "input border-red-500 focus:border-red-500"
              : "input"
          }
          placeholder="refund-policy"
        />
        <FieldError state={state} name="name" />
        <p className="mt-1 text-xs text-faint">
          What staff type after <code>/snippet</code>.
        </p>
      </div>
      <SubmitButton>Create</SubmitButton>
      <FormToast state={state} />
    </form>
  );
}
