import { Moon, PanelLeft, PanelRight, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isLanguage, supportedLanguages, toLanguage } from '@/i18n';
import { useUiStore } from '@/state/ui-store';

import { BrandMark } from './brand-mark';
import { EewStatus } from '@/features/eew';
import { ScenarioStatus } from './scenario-status';
import { SimulationClock } from './simulation-clock';
import type { LayoutMode } from './use-layout-mode';

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <div aria-hidden className="h-5 w-px shrink-0 bg-line" />;
}

export function StatusBar({ layout }: { layout: LayoutMode }) {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const setOpenDrawer = useUiStore((state) => state.setOpenDrawer);
  const language = toLanguage(i18n.resolvedLanguage);
  const themeLabel = theme === 'dark' ? t('status.theme.toLight') : t('status.theme.toDark');

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-2 sm:px-3">
      {layout === 'tablet' && (
        <IconButton
          label={t('status.openLeft')}
          onClick={() => {
            setOpenDrawer('left');
          }}
        >
          <PanelLeft />
        </IconButton>
      )}

      <div className="flex items-center gap-2">
        <BrandMark className="text-signal" />
        {/* Phones keep the mark only, leaving room for the clock and the alert. */}
        <h1
          className={
            layout === 'phone' ? 'sr-only' : 'text-body font-semibold tracking-tight text-fg'
          }
        >
          {t('app.name')}
        </h1>
      </div>

      <Divider />

      <div className="flex shrink-0 items-baseline gap-2" aria-live="off">
        {layout !== 'phone' && <span className="label-micro">{t('status.clock')}</span>}
        <SimulationClock />
      </div>

      {layout !== 'phone' && (
        <>
          <Divider />
          <ScenarioStatus />
        </>
      )}
      <EewStatus compact={layout === 'phone'} />

      <div className="ml-auto flex items-center gap-1.5">
        <ToggleGroup
          type="single"
          value={language}
          aria-label={t('status.language')}
          onValueChange={(value) => {
            if (isLanguage(value)) void i18n.changeLanguage(value);
          }}
        >
          {supportedLanguages.map((code) => (
            <ToggleGroupItem key={code} value={code} aria-label={t(`languages.${code}`)}>
              {code.toUpperCase()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <IconButton label={themeLabel} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>

        {layout === 'tablet' && (
          <IconButton
            label={t('status.openRight')}
            onClick={() => {
              setOpenDrawer('right');
            }}
          >
            <PanelRight />
          </IconButton>
        )}
      </div>
    </header>
  );
}
