import { ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';

export function EventsPanel() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={ScrollText}
      title={t('panels.events.emptyTitle')}
      description={t('panels.events.emptyBody')}
    />
  );
}
