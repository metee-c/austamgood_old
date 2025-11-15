import MainLayout from '@/components/layout/MainLayout';

export default function MasterDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}