export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/groups/:path*"],
};
export const runtime = "nodejs";
