import { useIntl } from 'react-intl';
import { AppShell } from '@ui/components/AppShell';

export function DashboardPage() {
  const intl = useIntl();

  return (
    <AppShell>
      <section className="dashboard-card">
        <h1>{intl.formatMessage({ id: 'dashboard.title' })}</h1>
        <p>{intl.formatMessage({ id: 'dashboard.subtitle' })}</p>
      </section>
    </AppShell>
  );
}
