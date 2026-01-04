import MainLayout from '@/components/layout/MainLayout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <div className="h-full overflow-auto">
        {children}
      </div>
    </MainLayout>
  );
}