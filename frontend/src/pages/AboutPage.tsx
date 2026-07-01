import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

function Section({ title, body }: { title: string; body: string }) {
  return (
    <Card className="surface-panel">
      <div className="p-5 md:p-6">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
        <p className="mt-3 text-sm leading-7 text-foreground">{body}</p>
      </div>
    </Card>
  );
}

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="surface-hero mb-6 p-5 md:p-6">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('about.hero_kicker')}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('about.title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('about.subtitle')}</p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-foreground">{t('about.hero_body')}</p>
      </div>

      <div className="space-y-4">
        <Section title={t('about.section_what_is')} body={t('about.what_is_body')} />
        <Section title={t('about.section_what_does')} body={t('about.what_does_body')} />
        <Section title={t('about.section_what_not')} body={t('about.what_not_body')} />
        <Section title={t('about.section_how')} body={t('about.how_body')} />
        <Section title={t('about.section_for_who')} body={t('about.for_who_body')} />
        <Section title={t('about.section_transparency')} body={t('about.transparency_body')} />

        <div className="pt-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl border bg-card p-2 shadow-[0_24px_70px_rgba(15,23,32,0.16)]">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <img
                src="/og-image.png"
                alt="Systemfehler"
                className="aspect-[1200/630] w-full rounded-2xl object-cover"
                loading="lazy"
              />
            </div>

            <div className="mt-4 flex justify-center">
              <Button asChild variant="outline" size="sm">
                <Link to="/">{t('about.back_to_home')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
