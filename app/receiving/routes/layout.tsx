'use client';

import { RoutePlanProvider } from './contexts/RoutePlanContext';

export default function RoutesLayout({ children }: { children: React.ReactNode }) {
  return <RoutePlanProvider>{children}</RoutePlanProvider>;
}
