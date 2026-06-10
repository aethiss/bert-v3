import type { Database } from 'sqlite';
import type { PersistedUserProfile } from '../../shared/types/user';

export interface UserService {
  getUserProfile(): Promise<PersistedUserProfile | null>;
  saveUserProfile(profile: PersistedUserProfile): Promise<void>;
  clearUserProfile(): Promise<void>;
}

export function createUserService(db: Database): UserService {
  return {
    async getUserProfile() {
      const record = await db.get<PersistedUserProfile>(
        'SELECT user_id as id, email, corporate_partner as corporatePartner, fdp, field_office as fieldOffice FROM "user" WHERE id = 1'
      );
      return record ?? null;
    },
    async saveUserProfile(profile) {
      await db.run(
        `
        INSERT INTO "user" (id, user_id, email, corporate_partner, fdp, field_office)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          email = excluded.email,
          corporate_partner = excluded.corporate_partner,
          fdp = excluded.fdp,
          field_office = excluded.field_office,
          updated_at = CURRENT_TIMESTAMP
        `,
        profile.id,
        profile.email,
        profile.corporatePartner,
        profile.fdp,
        profile.fieldOffice
      );
    },
    async clearUserProfile() {
      await db.run('DELETE FROM "user" WHERE id = 1');
    }
  };
}
