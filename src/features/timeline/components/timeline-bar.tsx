import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface TimelineBarProps {
  compact?: boolean;
  className?: string;
}

export function TimelineBar({ compact = false, className }: TimelineBarProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('timeline.label')}
      className={cn(
        'flex shrink-0 items-center gap-2 bg-surface-1 px-2',
        compact ? 'h-11' : 'h-14 border-t border-line px-3',
        className,
      )}
    >
      <Button variant="ghost" size="icon" disabled aria-label={t('timeline.play')}>
        <Play />
      </Button>
      <div className="relative flex h-7 min-w-0 flex-1 items-center rounded-control border border-line bg-surface-2 ruler px-3">
        <span className="truncate text-caption text-fg-muted">{t('timeline.idle')}</span>
      </div>
    </section>
  );
}
