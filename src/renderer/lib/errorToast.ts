import { toast } from 'sonner';
import { toErrorMessage } from './errorMessage';
import { getUiMessage } from '@renderer/i18n/messages';

export function showErrorToast(error: unknown): void {
  toast.error(getUiMessage('common.error', 'Error'), {
    description: toErrorMessage(error)
  });
}
