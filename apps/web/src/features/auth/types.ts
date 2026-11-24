/** The two ways in: sign in, or create an account. */
export type AuthTab = 'login' | 'signup';

/** The page of each way in; the tabs and the links between them keep the query (`next`). */
export const AUTH_PATHS = { login: '/login', signup: '/signup' } as const satisfies Record<
  AuthTab,
  string
>;

/** Id of a tab of `AuthTabs`, from the prefix the card gives (`aria-labelledby` of its panel). */
export const authTabId = (idPrefix: string, tab: AuthTab) => `${idPrefix}-${tab}`;
