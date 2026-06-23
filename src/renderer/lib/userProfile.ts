import type { PersistedUserProfile } from '@shared/types/user';

export function getLocalizedFdpName(profile: Pick<
  PersistedUserProfile,
  'fdpEnName' | 'fdpArName' | 'fieldOffice'
>, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  const englishName = (profile.fdpEnName ?? profile.fieldOffice ?? '').trim();
  const arabicName = (profile.fdpArName ?? '').trim();

  if (normalizedLocale.startsWith('ar')) {
    return arabicName || englishName;
  }

  return englishName || arabicName;
}

export function getMainCorporatePartnerName(
  profile: Pick<PersistedUserProfile, 'mainCorporatePartner' | 'corporatePartner'>
): string {
  return (profile.mainCorporatePartner ?? profile.corporatePartner ?? '').trim();
}
