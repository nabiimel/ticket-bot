"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { emptyFormState } from "@/lib/form";
import { addBlacklist } from "@/app/dashboard/[guildId]/actions";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FormFeedback";
import { FormToast } from "./FormToast";

export function BlacklistAddForm({ guildId }: { guildId: string }) {
  const [state, formAction] = useFormState(
    addBlacklist.bind(null, guildId),
    emptyFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="card flex flex-wrap items-end gap-3"
    >
      <div className="grow">
        <label className="label">Discord user ID</label>
        <input
          name="userId"
          className={
            state?.fieldErrors?.userId ? "input input-invalid" : "input"
          }
          placeholder="123456789012345678"
        />
        <FieldError state={state} name="userId" />
        <p className="mt-1 text-xs text-faint">
          Developer Mode → right-click the user → Copy User ID.
        </p>
      </div>
      <div className="grow">
        <label className="label">Reason (optional)</label>
        <input name="reason" className="input" />
        <p className="mt-1 text-xs text-faint">Only staff see this.</p>
        <FieldError state={state} name="reason" />
      </div>
      <SubmitButton>Block</SubmitButton>
      <FormToast state={state} />
    </form>
  );
}
