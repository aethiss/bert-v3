import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@ui/components/ui/select';
import type { SupportedLocale } from '@shared/types/language';
import { useLocale } from '@renderer/i18n/localeContext';
import { showErrorToast } from '@renderer/lib/errorToast';

export function LanguageSettings() {
  const intl = useIntl();
  const { locale, setLocale } = useLocale();
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(locale);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedLocale(locale);
  }, [locale]);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await setLocale(selectedLocale);
      toast.success(intl.formatMessage({ id: 'common.saved' }), {
        description: intl.formatMessage({ id: 'config.language.updatedDescription' })
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="configuration-form">
      <p className="server-form-label">{intl.formatMessage({ id: 'config.language.title' })}</p>
      <p className="server-form-muted">{intl.formatMessage({ id: 'config.language.description' })}</p>

      <label className="server-form-label">
        {intl.formatMessage({ id: 'config.language.select' })}
        <Select
          className="server-form-control"
          value={selectedLocale}
          disabled={isSaving}
          onChange={(event) => {
            const nextLocale = event.target.value;
            if (nextLocale === 'en' || nextLocale === 'ar') {
              setSelectedLocale(nextLocale);
            }
          }}
        >
          <option value="en">{intl.formatMessage({ id: 'config.language.option.en' })}</option>
          <option value="ar">{intl.formatMessage({ id: 'config.language.option.ar' })}</option>
        </Select>
      </label>

      <Button
        className="server-btn server-start-btn"
        onClick={() => {
          void handleSave();
        }}
        disabled={isSaving || selectedLocale === locale}
      >
        {isSaving
          ? intl.formatMessage({ id: 'common.saving' })
          : intl.formatMessage({ id: 'common.save' })}
      </Button>
    </div>
  );
}
