import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    /** True when signed in through the operator back-door, not Discord. */
    dev?: boolean;
    user?: {
      discordId?: string;
      dev?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    dev?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    discordId?: string;
    error?: string;
    dev?: boolean;
  }
}
