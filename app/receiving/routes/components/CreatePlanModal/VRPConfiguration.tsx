'use client';

import React from 'react';
import OptimizationSidebar, { OptimizationSettings } from '@/components/vrp/OptimizationSidebar';

interface VRPConfigurationProps {
  settings: OptimizationSettings;
  onChange: (changes: Partial<OptimizationSettings>) => void;
  onSave: () => void;
  disabled?: boolean;
  isSaving?: boolean;
  statusMessage?: string;
}

export function VRPConfiguration({
  settings,
  onChange,
  onSave,
  disabled = false,
  isSaving = false,
  statusMessage,
}: VRPConfigurationProps) {
  return (
    <div className="border-t pt-4">
      <OptimizationSidebar
        isOpen={true}
        settings={settings}
        onChange={onChange}
        onSave={onSave}
        disabled={disabled}
        isSaving={isSaving}
        statusMessage={statusMessage}
      />
    </div>
  );
}
