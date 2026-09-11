import ytdlpDefault from "yt-dlp-exec";

/**
 * yt-dlp-exec's CJS module attaches `.exec` to the default-exported function
 * at runtime (`fn.exec = ...` inside its own `create()`), but that assignment
 * isn't visible to Node's static CJS→ESM named-export analysis, so
 * `import { exec } from "yt-dlp-exec"` throws at load time under our ESM
 * bot even though it type-checks. Go through the default import instead,
 * which Node always supports for CJS interop.
 */
export interface YtDlpChildProcess extends Promise<{
  stdout: string;
  stderr: string;
}> {
  stdout: NodeJS.ReadableStream | null;
  stdin?: NodeJS.WritableStream | null;
  kill(signal?: string): boolean;
}

interface YtDlpModule {
  exec(url: string, flags?: Record<string, unknown>): YtDlpChildProcess;
}

const ytdlp = ytdlpDefault as unknown as YtDlpModule;

export const ytdlpExec = (
  url: string,
  flags?: Record<string, unknown>,
): YtDlpChildProcess => ytdlp.exec(url, flags);
