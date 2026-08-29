"use client";

import { useEffect, useState } from "react";
import { fmtAgo, fmtDuration } from "@/lib/format";

/**
 * A relative time that updates itself every 30s without a page refresh.
 * `initial` is the server-rendered string, so hydration matches exactly.
 */
export function Relative({
  unix,
  ago = false,
  initial,
}: {
  unix: number;
  ago?: boolean;
  initial: string;
}) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const compute = () =>
      setText(ago ? fmtAgo(unix) : fmtDuration(Date.now() / 1000 - unix));
    compute();
    const id = setInterval(compute, 30_000);
    return () => clearInterval(id);
  }, [unix, ago]);

  return <>{text}</>;
}
