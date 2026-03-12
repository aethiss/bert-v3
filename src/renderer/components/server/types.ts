export type ServerSection = 'overview' | 'distribution' | 'operations' | 'data' | 'configuration';

export type OverviewMode = 'empty' | 'data';

export type DistributionMode = 'search' | 'result';

export type ConfigurationTab = 'server' | 'printer' | 'log';

export interface ServerRouteState {
  section: ServerSection;
  overviewMode: OverviewMode;
  distributionMode: DistributionMode;
  configurationTab: ConfigurationTab;
}

export interface ServerRouteComponentProps {
  route: ServerRouteState;
  onNavigate: (nextRoute: ServerRouteState) => void;
}
