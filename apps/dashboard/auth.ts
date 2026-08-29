import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";

/** Exchange the refresh token for a fresh access token. */
async function refreshDiscordToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !data.access_token) throw new Error("token refresh failed");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    accessTokenExpires: Date.now() + (data.expires_in ?? 604800) * 1000,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in.
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 604800 * 1000;
        if (profile?.id) token.discordId = profile.id as string;
        delete token.error;
        return token;
      }

      const expires = (token.accessTokenExpires as number | undefined) ?? 0;
      const refreshToken = token.refreshToken as string | undefined;

      // Still valid (60s skew).
      if (expires && Date.now() < expires - 60_000) {
        return token;
      }

      // Expired — try to refresh.
      if (!refreshToken) {
        token.error = "NoRefreshToken";
        return token;
      }
      try {
        const refreshed = await refreshDiscordToken(refreshToken);
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.accessTokenExpires = refreshed.accessTokenExpires;
        delete token.error;
      } catch {
        token.error = "RefreshAccessTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      if (session.user) {
        session.user.discordId = token.discordId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
