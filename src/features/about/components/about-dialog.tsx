import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useManifest } from '@/data/use-dataset';
import { aboutSections, useUiStore, type AboutSection } from '@/state/ui-store';

const REPOSITORY_URL = 'https://github.com/ozcelikcode/quake-trace';
const SCENARIO_SOURCES = ['presets', 'editor', 'replay', 'live'] as const;
const METHODS = [
  'rupture',
  'waves',
  'groundMotion',
  'records',
  'eew',
  'damage',
  'network',
  'routing',
  'tsunami',
  'aftershocks',
] as const;
const LIVE_SERVICES = ['afad', 'kandilli', 'emsc', 'usgs', 'basemap'] as const;
const SHORTCUTS = [
  { keys: ['Space'], id: 'play' },
  { keys: ['←', '→'], id: 'step' },
  { keys: ['Shift', '←', '→'], id: 'jump' },
  { keys: ['?'], id: 'help' },
  { keys: ['Ctrl / ⌘', 'P'], id: 'print' },
] as const;

function isAboutSection(value: string): value is AboutSection {
  return (aboutSections as readonly string[]).includes(value);
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-body font-semibold text-fg">{children}</h3>;
}

function Overview() {
  const { t } = useTranslation();
  return (
    <div className="max-w-prose space-y-5">
      <div className="space-y-1 rounded-panel border border-critical/50 bg-surface-2 p-3">
        <p className="text-body font-semibold text-critical">
          {t('about.overview.disclaimerTitle')}
        </p>
        <p className="text-caption text-fg-secondary">{t('about.overview.disclaimer')}</p>
      </div>
      <p className="text-body text-fg-secondary">{t('about.overview.what')}</p>
      <section className="space-y-2">
        <Heading>{t('about.overview.modesTitle')}</Heading>
        <ul className="list-disc space-y-1 pl-5 text-caption text-fg-secondary">
          {SCENARIO_SOURCES.map((mode) => (
            <li key={mode}>{t(`about.overview.modes.${mode}`)}</li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <Heading>{t('about.overview.shareTitle')}</Heading>
        <p className="text-caption text-fg-secondary">{t('about.overview.share')}</p>
      </section>
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-caption font-medium text-signal underline-offset-2 hover:underline"
      >
        {t('about.overview.source')}
        <ExternalLink aria-hidden className="size-3.5" />
      </a>
    </div>
  );
}

function Methods() {
  const { t } = useTranslation();
  return (
    <div className="max-w-prose space-y-5">
      <p className="text-caption text-fg-secondary">{t('about.methods.intro')}</p>
      <dl className="space-y-3">
        {METHODS.map((method) => (
          <div key={method} className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
            <dt className="text-caption font-medium text-fg">
              {t(`about.methods.items.${method}.title`)}
            </dt>
            <dd className="text-caption text-fg-secondary">
              {t(`about.methods.items.${method}.body`)}
            </dd>
          </div>
        ))}
      </dl>
      <section className="space-y-2">
        <Heading>{t('about.methods.validationTitle')}</Heading>
        <p className="text-caption text-fg-secondary">{t('about.methods.validation')}</p>
      </section>
      <section className="space-y-2">
        <Heading>{t('about.methods.limitsTitle')}</Heading>
        <p className="text-caption text-fg-secondary">{t('about.methods.limits')}</p>
      </section>
    </div>
  );
}

function DataSources() {
  const { t } = useTranslation();
  const manifest = useManifest().data;
  // Several datasets share a source (districts and district cells); list each once.
  const sources = [
    ...new Map(
      Object.values(manifest?.datasets ?? {})
        .flatMap((dataset) => dataset.sources)
        .map((source) => [source.name, source]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-prose space-y-5">
      <section className="space-y-2">
        <p className="text-caption text-fg-secondary">{t('about.data.intro')}</p>
        <ul className="space-y-2.5">
          {sources.map((source) => (
            <li key={source.name} className="space-y-0.5">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-caption font-medium text-fg underline-offset-2 hover:underline"
              >
                {source.name}
              </a>
              <p className="text-micro text-fg-muted">
                {source.attribution} · {t('about.data.license', { license: source.license })}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <Heading>{t('about.data.liveTitle')}</Heading>
        <ul className="list-disc space-y-1 pl-5 text-caption text-fg-secondary">
          {LIVE_SERVICES.map((service) => (
            <li key={service}>{t(`about.data.live.${service}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Shortcuts() {
  const { t } = useTranslation();
  return (
    <div className="max-w-prose space-y-4">
      <p className="text-caption text-fg-secondary">{t('about.shortcuts.intro')}</p>
      <dl className="divide-y divide-line rounded-panel border border-line">
        {SHORTCUTS.map(({ keys, id }) => (
          <div key={id} className="flex items-center justify-between gap-4 px-3 py-2">
            <dt className="text-caption text-fg">{t(`about.shortcuts.items.${id}`)}</dt>
            <dd className="flex shrink-0 gap-1">
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="min-w-6 rounded-control border border-line-strong bg-surface-2 px-1.5 py-0.5 text-center num text-micro text-fg"
                >
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** About, methods, data sources and keyboard shortcuts, opened from the status bar or `?`. */
export function AboutDialog() {
  const { t } = useTranslation();
  const section = useUiStore((state) => state.about);
  const setAbout = useUiStore((state) => state.setAbout);

  return (
    <Dialog
      open={section !== null}
      onOpenChange={(open) => {
        if (!open) setAbout(null);
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        <div className="space-y-1 border-b border-line px-4 pt-4 pr-12 pb-3">
          <DialogTitle>{t('about.title')}</DialogTitle>
          <DialogDescription>{t('about.description')}</DialogDescription>
        </div>
        <Tabs
          value={section ?? 'overview'}
          onValueChange={(value) => {
            if (isAboutSection(value)) setAbout(value);
          }}
          className="min-h-0 flex-1"
        >
          <TabsList aria-label={t('about.title')} className="px-3">
            {aboutSections.map((option) => (
              <TabsTrigger key={option} value={option}>
                {t(`about.sections.${option}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview" className="overflow-y-auto p-4">
            <Overview />
          </TabsContent>
          <TabsContent value="methods" className="overflow-y-auto p-4">
            <Methods />
          </TabsContent>
          <TabsContent value="data" className="overflow-y-auto p-4">
            <DataSources />
          </TabsContent>
          <TabsContent value="shortcuts" className="overflow-y-auto p-4">
            <Shortcuts />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
