"use client";

import { useFormState } from "react-dom";
import { emptyFormState } from "@/lib/form";
import { createCategoryFromForm } from "@/app/dashboard/[guildId]/actions";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FormFeedback";
import { FormToast } from "./FormToast";

export function CategoryCreateForm({ guildId }: { guildId: string }) {
  const [state, formAction] = useFormState(
    createCategoryFromForm.bind(null, guildId),
    emptyFormState,
  );

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Reference ID</label>
        <input
          name="key"
          className={state?.fieldErrors?.key ? "input input-invalid" : "input"}
          placeholder="support"
        />
        <FieldError state={state} name="key" />
      </div>
      <div className="grow">
        <label className="label">Display name</label>
        <input
          name="label"
          className={
            state?.fieldErrors?.label ? "input input-invalid" : "input"
          }
          placeholder="Support"
        />
        <FieldError state={state} name="label" />
      </div>
      <SubmitButton>Create</SubmitButton>
      <FormToast state={state} />
    </form>
  );
}
