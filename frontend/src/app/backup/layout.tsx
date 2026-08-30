import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'S3 Backup — Mekong Salt Lab',
  description: 'Công cụ sao lưu dữ liệu S3 nội bộ',
  robots: { index: false, follow: false },
};

export default function BackupLayout({ children }: { children: React.ReactNode }) {
  // Standalone layout — không dùng header/footer của app chính
  return <>{children}</>;
}
