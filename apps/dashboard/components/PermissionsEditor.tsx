"use client";

import { useState, useTransition } from "react";
import { setDashboardGrant } from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";

type Role = { id: string; name: string; color: number };

const OPTIONS = [
  { value: "none", label: "No access" },
  { value: "console", label: "Console — work tickets" },
  { value: "editor", label: "Editor — + edit config" },
  { value: "admin", label: "Admin — everything" },
];

export function PermissionsEditor({
  guildId,
  roles,
  grants,
}: {
  guildId: string;
  roles: Role[];
  grants: Record<string, string>;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [state, setState] = useState<Record<string, string>>(grants);

  const change = (roleId: string, level: string) => {
    const prev = state[roleId] ?? "none";
    setState((s) => ({ ...s, [roleId]: level }));
    start(async () => {
      const res = await setDashboardGrant(guildId, roleId, level);
      if (res.ok) toast.success("Access updated");
      else {
        setState((s) => ({ ...s, [roleId]: prev }));
        toast.error(res.error ?? "Couldn't update access");
      }
    });
  };

  return (
    <div className="card">
      <p className="mb-3 text-sm text-faint">
        Anyone with <strong>Manage Server</strong> always has full admin access.
        Grant extra access to specific roles here — members get the highest
        level of any role they hold.
      </p>
      <ul className={`divide-y divide-line ${pending ? "opacity-70" : ""}`}>
        {roles.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                background: r.color
                  ? `#${r.color.toString(16).padStart(6, "0")}`
                  : "var(--text-faint)",
              }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            <select
              className="input max-w-[15rem] text-sm"
              value={state[r.id] ?? "none"}
              disabled={pending}
              onChange={(e) => change(r.id, e.target.value)}
            >
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
