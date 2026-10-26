import { Check, Link } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

const CONFIRM_MS = 2000;

/** Copies the page URL, which always carries the running scenario (`run-request.ts`). */
export function ShareLinkButton() {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => {
      setState('idle');
    }, CONFIRM_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(window.location.href).then(
            () => {
              setState('copied');
            },
            () => {
              setState('failed');
            },
          );
        }}
      >
        {state === 'copied' ? <Check /> : <Link />}
        {t(`scenario.share.${state}`)}
      </Button>
      <span role="status" className="sr-only">
        {state === 'idle' ? '' : t(`scenario.share.${state}`)}
      </span>
    </>
  );
}
