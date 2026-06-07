import { networkInterfaces } from 'node:os';

export function getDeviceMacAddress(): string | null {
  const interfaces = networkInterfaces();
  let fallbackMac: string | null = null;

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      const mac = address.mac?.trim();
      if (!mac || mac === '00:00:00:00:00:00') {
        continue;
      }

      if (!fallbackMac) {
        fallbackMac = mac;
      }

      if (
        address.family === 'IPv4' &&
        !address.internal &&
        !address.address.startsWith('169.254.')
      ) {
        return mac;
      }
    }
  }

  return fallbackMac;
}
