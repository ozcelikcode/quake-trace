import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';

export function ScenarioPanel() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={SlidersHorizontal}
      title={t('panels.scenario.emptyTitle')}
      description={t('panels.scenario.emptyBody')}
    />
  );
}
