import MainLayout from '@/components/layout/MainLayout';

export default function ShippingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}