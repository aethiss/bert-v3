export type ClientSection = 'overview' | 'distribution' | 'configuration';

export type ClientDistributionMode = 'search' | 'result' | 'detail';

export type ClientConfigurationTab = 'connection' | 'printer' | 'updates' | 'developer';

export interface ClientRouteState {
  section: ClientSection;
  distributionMode: ClientDistributionMode;
  configurationTab: ClientConfigurationTab;
  distributionLookup?: string | null;
}

export interface ClientRouteComponentProps {
  route: ClientRouteState;
  onNavigate: (nextRoute: ClientRouteState) => void;
}
