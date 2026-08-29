"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the *viewer's* timezone. Server components format with
 * the host's TZ (UTC on the box); `initial` is that value, shown until mount,
 * then replaced with the browser-local formatting.
 */
export function LocalTime({
  unix,
  initial,
  dateOnly = false,
}: {
  unix: number;
  initial: string;
  dateOnly?: boolean;
}) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const d = new Date(unix * 1000);
    setText(dateOnly ? d.toLocaleDateString() : d.toLocaleString());
  }, [unix, dateOnly]);

  return <span suppressHydrationWarning>{text}</span>;
}
