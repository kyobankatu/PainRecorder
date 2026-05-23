import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { clearAttempts, isRateLimited, recordFailedAttempt } from './rate-limit';
import { getClientIp } from './request';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT_PER_ACCOUNT = 5;
const LOGIN_LIMIT_PER_IP = 20;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'ユーザー名', type: 'text' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        const username = credentials.username.trim();
        const ip = getClientIp(req.headers);
        const accountKey = `login:${ip}:${username.toLowerCase()}`;
        const ipKey = `login:${ip}`;

        if (
          isRateLimited(accountKey, LOGIN_LIMIT_PER_ACCOUNT, LOGIN_WINDOW_MS) ||
          isRateLimited(ipKey, LOGIN_LIMIT_PER_IP, LOGIN_WINDOW_MS)
        ) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username },
        });
        if (!user) {
          recordFailedAttempt(accountKey, LOGIN_WINDOW_MS);
          recordFailedAttempt(ipKey, LOGIN_WINDOW_MS);
          return null;
        }
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          recordFailedAttempt(accountKey, LOGIN_WINDOW_MS);
          recordFailedAttempt(ipKey, LOGIN_WINDOW_MS);
          return null;
        }
        clearAttempts(accountKey);
        return { id: user.id, name: user.username };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: { signIn: '/' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
