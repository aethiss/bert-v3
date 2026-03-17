export interface LocalServerInterfaceInfo {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
}

export interface LocalServerSettings {
  interfaceName: string;
  bindIp: string;
  port: number;
  oneTimePassword: string;
}

export interface LocalServerStatus {
  running: boolean;
  bindIp: string;
  port: number;
  startedAt: string | null;
  activeClients: number;
}

export interface LocalServerClientPresence {
  alias: string;
  isConnected: boolean;
  lastSeenAt: string | null;
}

export interface ClientConnectionSettings {
  serverIp: string;
  serverPort: number;
  oneTimePassword: string;
  alias: string;
}
