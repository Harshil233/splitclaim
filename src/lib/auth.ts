import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import bcrypt from "bcryptjs";
import { AuthOptions } from "next-auth";

const providers: any[] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Please enter your email and password");
      }

      await dbConnect();
      const user = await User.findOne({ email: credentials.email.toLowerCase() });

      if (!user) {
        throw new Error("No user found with this email");
      }

      const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);

      if (!isPasswordCorrect) {
        throw new Error("Incorrect password");
      }

      if (user.isVerified === false) {
        throw new Error("Please verify your email address first");
      }

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      };
    }
  })
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: AuthOptions = {
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await dbConnect();
        const email = user.email?.toLowerCase();
        let dbUser = await User.findOne({ email });
        
        if (!dbUser) {
          // Generate a dummy password to satisfy Mongoose validation requirements
          const dummyPassword = Math.random().toString(36).slice(-10);
          const hashedPassword = await bcrypt.hash(dummyPassword, 12);
          dbUser = await User.create({
            name: user.name || "Google User",
            email,
            password: hashedPassword,
            isVerified: true,
          });
        }
        // Override user.id with the MongoDB ObjectId string
        user.id = dbUser._id.toString();
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
