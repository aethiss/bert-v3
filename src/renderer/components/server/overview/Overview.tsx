import { House, UsersRound } from 'lucide-react';
import { Button } from '@ui/components/ui/button';
import type { ServerRouteComponentProps } from '@renderer/components/server/types';

export function Overview({ route, onNavigate }: ServerRouteComponentProps) {
  if (route.overviewMode === 'empty') {
    return (
      <section className="server-content-block">
        <h1 className="server-page-title">Home</h1>
        <div className="server-row-headline">
          <p>Synchronize data to start using the Application</p>
          <Button
            className="server-btn"
            onClick={() => {
              onNavigate({
                ...route,
                section: 'overview',
                overviewMode: 'data'
              });
            }}
          >
            Synchronize
          </Button>
        </div>
        <hr className="server-divider" />
      </section>
    );
  }

  return (
    <section className="server-content-block">
      <h1 className="server-page-title">Overview</h1>
      <div className="overview-cards-grid">
        <article className="overview-card">
          <div className="overview-card-head">
            <p>SFA - Jan</p>
            <span className="overview-chip">SFA</span>
          </div>
          <p className="overview-card-value">5000</p>
          <p className="overview-card-sub">01/Jan/2026 - 31/Jan/2026</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-head">
            <p>BSFP - Dec</p>
            <span className="overview-chip">BSFP</span>
          </div>
          <p className="overview-card-value">1000</p>
          <p className="overview-card-sub">10/Jan/2026 - 25/Feb/2026</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-head">
            <p>Members</p>
            <UsersRound size={16} />
          </div>
          <p className="overview-card-value">1350</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-head">
            <p>Households</p>
            <House size={16} />
          </div>
          <p className="overview-card-value">400</p>
        </article>
      </div>
    </section>
  );
}
