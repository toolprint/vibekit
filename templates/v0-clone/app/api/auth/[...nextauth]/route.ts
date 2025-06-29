import NextAuth, { NextAuthOptions, DefaultSession } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

declare module "next-auth" {
  interface Session extends DefaultSession {
    githubAccessToken?: string;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

// 2. Auth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.githubAccessToken = token.accessToken;
      return session;
    },
  },
};

// 3. Export route handlers for App Router
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
