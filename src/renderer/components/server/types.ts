export type ServerSection = 'overview' | 'distribution' | 'operations' | 'data' | 'configuration';

export type DistributionMode = 'search' | 'result' | 'detail';

export type ConfigurationTab = 'server' | 'printer' | 'log' | 'language' | 'updates' | 'developer';

export interface ServerRouteState {
  section: ServerSection;
  distributionMode: DistributionMode;
  configurationTab: ConfigurationTab;
}

export interface ServerRouteComponentProps {
  route: ServerRouteState;
  onNavigate: (nextRoute: ServerRouteState) => void;
}
