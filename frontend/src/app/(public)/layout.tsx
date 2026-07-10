import { homeMetadata } from "@/lib/seo/config";

export const metadata = homeMetadata;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
