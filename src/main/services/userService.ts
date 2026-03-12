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
        'SELECT email, fdp, field_office as fieldOffice FROM "user" WHERE id = 1'
      );
      return record ?? null;
    },
    async saveUserProfile(profile) {
      await db.run(
        `
        INSERT INTO "user" (id, email, fdp, field_office)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          fdp = excluded.fdp,
          field_office = excluded.field_office,
          updated_at = CURRENT_TIMESTAMP
        `,
        profile.email,
        profile.fdp,
        profile.fieldOffice
      );
    },
    async clearUserProfile() {
      await db.run('DELETE FROM "user" WHERE id = 1');
    }
  };
}
