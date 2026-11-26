import { createContext, use } from 'react';
import { appConfig, type AppConfig } from './app';

/**
 * The product configuration as the screens read it. Its default is the real one (`appConfig`), so
 * the app needs no provider; the tests and the dev `?state=` forcing give another value.
 */
export const AppConfigContext = createContext<AppConfig>(appConfig);

export function useAppConfig(): AppConfig {
  return use(AppConfigContext);
}
