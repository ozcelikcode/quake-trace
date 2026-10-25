import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';

export function ImpactPanel() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Building2}
      title={t('panels.impact.emptyTitle')}
      description={t('panels.impact.emptyBody')}
    />
  );
}
