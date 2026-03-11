import { useInstallerModeSetup } from '@hooks/useInstallerModeSetup';
import { InstallerModeModal } from '@ui/components/installer/InstallerModeModal';
import { DashboardPage } from '@renderer/pages/DashboardPage';
import { LoginPage } from '@renderer/pages/LoginPage';
import { useAppSelector } from '@renderer/store/hooks';
import { selectIsAuthenticated } from '@renderer/store/selectors/authSelectors';

export function App() {
  const installerModeSetup = useInstallerModeSetup();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return (
    <>
      {isAuthenticated ? <DashboardPage /> : <LoginPage />}
      <InstallerModeModal
        isOpen={!installerModeSetup.isLoading && !installerModeSetup.isLocked}
        isSubmitting={installerModeSetup.isSubmitting}
        errorMessage={installerModeSetup.errorMessage}
        onConfirm={installerModeSetup.setMode}
      />
    </>
  );
}
