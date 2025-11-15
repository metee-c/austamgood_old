import MainLayout from '@/components/layout/MainLayout';

export default function ReceivingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}