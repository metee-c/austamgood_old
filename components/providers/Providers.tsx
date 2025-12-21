'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { AIChatProvider } from '@/contexts/AIChatContext';
import GlobalAIChat from '@/components/ai/GlobalAIChat';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AIChatProvider>
        {children}
        <GlobalAIChat />
      </AIChatProvider>
    </AuthProvider>
  );
}
