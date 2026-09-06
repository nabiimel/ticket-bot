import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    /** True when the signed-in Discord id is in DEV_DISCORD_IDS. */
    dev?: boolean;
    user?: {
      discordId?: string;
      dev?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    discordId?: string;
    error?: string;
  }
}
