import { toast } from 'sonner';
import { toErrorMessage } from './errorMessage';
import { getUiMessage } from '@renderer/i18n/messages';
import { logAppError } from '@renderer/services/configService';

export function showErrorToast(error: unknown): void {
  void logAppError('renderer:toast', toErrorMessage(error));
  toast.error(getUiMessage('common.error', 'Error'), {
    description: toErrorMessage(error)
  });
}
