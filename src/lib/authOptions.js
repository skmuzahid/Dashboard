import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const users = JSON.parse(process.env.DASHBOARD_USERS || "[]");
          const user = users.find(
            (u) =>
              u.username === credentials.username &&
              u.password === credentials.password
          );
          if (user) {
            return { id: user.username, name: user.name, email: user.username };
          }
        } catch (e) {
          console.error("Auth error:", e);
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
