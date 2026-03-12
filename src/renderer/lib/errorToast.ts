import { toast } from 'sonner';
import { toErrorMessage } from './errorMessage';

export function showErrorToast(error: unknown): void {
  toast.error('Error', {
    description: toErrorMessage(error)
  });
}
