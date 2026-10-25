import { AudioWaveform } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';

export function TelemetryPanel() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={AudioWaveform}
      title={t('panels.telemetry.emptyTitle')}
      description={t('panels.telemetry.emptyBody')}
    />
  );
}
