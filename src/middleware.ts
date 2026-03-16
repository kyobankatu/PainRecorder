import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/' },
});

export const config = {
  matcher: ['/dashboard/:path*', '/record/:path*', '/graph/:path*', '/settings/:path*', '/memo/:path*', '/print-preview/:path*'],
};
