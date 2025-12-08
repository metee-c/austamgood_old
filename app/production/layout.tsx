import MainLayout from '@/components/layout/MainLayout';

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
