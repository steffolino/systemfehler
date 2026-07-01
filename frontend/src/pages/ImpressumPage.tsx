import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

export default function ImpressumPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="surface-hero mb-6 p-5 md:p-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t('impressum.title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('impressum.subtitle')}</p>
      </div>

      <div className="space-y-5">
        <Card className="rounded-3xl border shadow-sm">
          <div className="p-5 md:p-6">
            <div className="mb-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('impressum.section_provider')}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard label={t('impressum.name')} value={t('impressum.value_name')} />
              <InfoCard label={t('impressum.legal_form')} value={t('impressum.value_legal_form')} />
              <div className="md:col-span-2">
                <InfoCard label={t('impressum.address')} value={t('impressum.value_address')} />
              </div>
              <InfoCard label={t('impressum.email')} value={t('impressum.value_email')} />
              <InfoCard label={t('impressum.phone')} value={t('impressum.value_phone')} />
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <div className="p-5 md:p-6">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('impressum.additional_info')}
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-foreground">
              <li>{t('impressum.value_register')}</li>
              <li>{t('impressum.value_vat')}</li>
              <li>{t('impressum.value_economic_id')}</li>
              <li>{t('impressum.value_supervisory')}</li>
              <li>{t('impressum.value_regulatory')}</li>
            </ul>
          </div>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <div className="p-5 md:p-6">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('impressum.editorial')}
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('impressum.editorial_note')}</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{t('impressum.value_editorial')}</p>
          </div>
        </Card>

        <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t('search.subtitle')}</span>
          <Link to="/" className="font-medium text-foreground underline underline-offset-4">
            {t('entry.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
