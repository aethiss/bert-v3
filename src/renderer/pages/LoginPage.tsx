import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { openCiamLogin } from '@services/authService';
import { useLazyExchangeCodeQuery, useLazyGetUserInfoQuery } from '@renderer/store/api/authApi';
import { useAppDispatch } from '@renderer/store/hooks';
import { setOnlineAuthSession } from '@renderer/store/authSlice';
import { Button } from '@ui/components/ui/button';
import { isRtkLikeError, toErrorMessage } from '@renderer/lib/errorMessage';
import { showErrorToast } from '@renderer/lib/errorToast';

export function LoginPage() {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [triggerExchangeCode, exchangeCodeState] = useLazyExchangeCodeQuery();
  const [triggerUserInfo, userInfoState] = useLazyGetUserInfoQuery();
  const [isOpeningCiamWindow, setIsOpeningCiamWindow] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = isOpeningCiamWindow || exchangeCodeState.isFetching || userInfoState.isFetching;

  const actionLabel = useMemo(() => {
    if (isOpeningCiamWindow) {
      return intl.formatMessage({ id: 'login.openingCiam' });
    }

    if (exchangeCodeState.isFetching) {
      return intl.formatMessage({ id: 'login.validatingToken' });
    }

    if (userInfoState.isFetching) {
      return intl.formatMessage({ id: 'login.loadingUserProfile' });
    }

    return intl.formatMessage({ id: 'login.withCiam' });
  }, [exchangeCodeState.isFetching, intl, isOpeningCiamWindow, userInfoState.isFetching]);

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
      <section className="login-shell" aria-label={intl.formatMessage({ id: 'login.layoutAria' })}>
        <aside className="login-left-panel">
          <div className="login-brand">
            <img
              className="login-brand-logo"
              src="https://uikit.wfp.org/cdn/logos/latest/wfp-logo-emblem-white-all.svg"
              alt={intl.formatMessage({ id: 'brand.wfp' })}
            />
            <p className="login-brand-text">{intl.formatMessage({ id: 'brand.wfp' })}</p>
          </div>

          <blockquote className="login-quote">
            <p>{intl.formatMessage({ id: 'login.quote' })}</p>
            <footer>{intl.formatMessage({ id: 'login.quoteAuthor' })}</footer>
          </blockquote>
        </aside>

        <section className="login-right-panel">
          <div className="login-form-container">
            <h1>{intl.formatMessage({ id: 'login.welcome' })}</h1>
            <p>{intl.formatMessage({ id: 'login.subtitle' })}</p>
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
