import { Fragment, type ReactNode } from "react";

/**
 * A small renderer for the subset of Discord-flavoured markdown that shows up in
 * embed text: **bold**, *italic*, __underline__, ~~strike~~, `code`, ```blocks```,
 * ||spoiler||, [links](url), # headings, > quotes, - bullets, and mention chips.
 * Not a full parser — good enough for a faithful preview.
 */

function inline(text: string, kp = "x"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let k = 0;
  const push = (n: ReactNode) =>
    out.push(<Fragment key={`${kp}-${k++}`}>{n}</Fragment>);

  while (rest.length) {
    let m: RegExpMatchArray | null;

    if ((m = rest.match(/^`([^`\n]+)`/))) {
      push(
        <code className="rounded bg-black/30 px-1 py-0.5 text-[0.85em]">
          {m[1]}
        </code>,
      );
    } else if ((m = rest.match(/^\*\*([\s\S]+?)\*\*/))) {
      push(<strong className="font-semibold">{inline(m[1], kp + k)}</strong>);
    } else if ((m = rest.match(/^__([\s\S]+?)__/))) {
      push(<u>{inline(m[1], kp + k)}</u>);
    } else if ((m = rest.match(/^~~([\s\S]+?)~~/))) {
      push(<s>{inline(m[1], kp + k)}</s>);
    } else if ((m = rest.match(/^\|\|([\s\S]+?)\|\|/))) {
      push(
        <span className="rounded bg-[#3c3f45] px-1 text-transparent transition-colors hover:text-[#dbdee1]">
          {inline(m[1], kp + k)}
        </span>,
      );
    } else if ((m = rest.match(/^(\*|_)([\s\S]+?)\1/))) {
      push(<em>{inline(m[2], kp + k)}</em>);
    } else if ((m = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/))) {
      push(
        <a
          href={m[2]}
          target="_blank"
          rel="noreferrer"
          className="text-[#00a8fc] hover:underline"
        >
          {m[1]}
        </a>,
      );
    } else if ((m = rest.match(/^<a?:(\w+):\d+>/))) {
      push(<span>{`:${m[1]}:`}</span>);
    } else if ((m = rest.match(/^<(@!?|@&|#)(\d+)>/))) {
      const label =
        m[1] === "#" ? "#channel" : m[1] === "@&" ? "@role" : "@user";
      push(
        <span className="rounded bg-[#3c4270] px-1 text-[#c9cdfb]">
          {label}
        </span>,
      );
    } else {
      // Plain text up to the next character that could start a token.
      m = rest.match(/^[\s\S][^*_~`|<[]*/);
      push(m ? m[0] : rest[0]);
    }
    rest = rest.slice(m && m[0].length ? m[0].length : 1);
  }
  return out;
}

const BLOCK_START = /^(#{1,3}\s|>\s?|\s*[-*]\s|```)/;

export function renderMarkdown(src: string): ReactNode {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded bg-black/30 p-2 text-[0.8125rem] leading-snug"
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const size = ["text-base", "text-[0.95rem]", "text-sm"][h[1].length - 1];
      blocks.push(
        <div key={key++} className={`font-bold text-white ${size}`}>
          {inline(h[2])}
        </div>,
      );
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]))
        buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 border-[#4f545c] pl-2 text-[#dbdee1]"
        >
          {buf.map((b, j) => (
            <div key={j}>{inline(b)}</div>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(
        <ul key={key++} className="list-disc space-y-0.5 pl-5">
          {buf.map((b, j) => (
            <li key={j}>{inline(b)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !BLOCK_START.test(lines[i])
    )
      buf.push(lines[i++]);
    blocks.push(
      <p key={key++}>
        {buf.map((b, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(b)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}
