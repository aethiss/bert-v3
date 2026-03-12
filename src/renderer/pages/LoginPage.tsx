import { useMemo, useState } from 'react';
import { openCiamLogin } from '@services/authService';
import { useLazyExchangeCodeQuery, useLazyGetUserInfoQuery } from '@renderer/store/api/authApi';
import { useAppDispatch } from '@renderer/store/hooks';
import { setOnlineAuthSession } from '@renderer/store/authSlice';
import { Button } from '@ui/components/ui/button';
import { isRtkLikeError, toErrorMessage } from '@renderer/lib/errorMessage';
import { showErrorToast } from '@renderer/lib/errorToast';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const [triggerExchangeCode, exchangeCodeState] = useLazyExchangeCodeQuery();
  const [triggerUserInfo, userInfoState] = useLazyGetUserInfoQuery();
  const [isOpeningCiamWindow, setIsOpeningCiamWindow] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = isOpeningCiamWindow || exchangeCodeState.isFetching || userInfoState.isFetching;

  const actionLabel = useMemo(() => {
    if (isOpeningCiamWindow) {
      return 'Opening CIAM...';
    }

    if (exchangeCodeState.isFetching) {
      return 'Validating token...';
    }

    if (userInfoState.isFetching) {
      return 'Loading user profile...';
    }

    return 'Login with CIAM';
  }, [exchangeCodeState.isFetching, isOpeningCiamWindow, userInfoState.isFetching]);

  const handleLogin = async (): Promise<void> => {
    setErrorMessage(null);
    setIsOpeningCiamWindow(true);

    try {
      console.info('[login] Opening CIAM flow');
      const ciamResult = await openCiamLogin();
      console.info('[login] Exchange key received from CIAM', {
        exchangeKeyPreview: `${ciamResult.exchangeKey.slice(0, 6)}...`,
        hasRefreshToken: Boolean(ciamResult.refreshToken)
      });

      const tokenResponse = await triggerExchangeCode(ciamResult.exchangeKey).unwrap();
      const jwt = tokenResponse.idToken;
      console.info('[login] JWT successfully exchanged');
      const profile = await triggerUserInfo(jwt).unwrap();
      console.info('[login] User profile loaded', { email: profile.email });

      dispatch(
        setOnlineAuthSession({
          jwt,
          refreshToken: tokenResponse.refreshToken ?? ciamResult.refreshToken,
          exchangeKey: ciamResult.exchangeKey,
          user: profile
        })
      );
    } catch (error: unknown) {
      console.error('[login] Login flow failed', error);
      const message = toErrorMessage(error);
      setErrorMessage(message);
      if (!isRtkLikeError(error)) {
        showErrorToast(message);
      }
    } finally {
      setIsOpeningCiamWindow(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell" aria-label="Login layout">
        <aside className="login-left-panel">
          <div className="login-brand">
            <img
              className="login-brand-logo"
              src="https://uikit.wfp.org/cdn/logos/latest/wfp-logo-emblem-white-all.svg"
              alt="World Food Programme"
            />
            <p className="login-brand-text">World Food Programme</p>
          </div>

          <blockquote className="login-quote">
            <p>
              This library has saved me countless hours of work and helped me deliver stunning designs to
              my clients faster than ever before.
            </p>
            <footer>Sofia Davis</footer>
          </blockquote>
        </aside>

        <section className="login-right-panel">
          <div className="login-form-container">
            <h1>Welcome to BeRT</h1>
            <p>Enter your email below to login</p>
            <Button
              onClick={() => void handleLogin()}
              className="login-submit-button"
              size="lg"
              disabled={isSubmitting}
            >
              {actionLabel}
            </Button>
            {errorMessage ? <p className="login-error-message">{errorMessage}</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
