import { MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';
import { BrowserCacheLocation, InteractionType, PublicClientApplication } from '@azure/msal-browser';

// ─── Scopes ───────────────────────────────────────────────────────────────────
const apiScope = 'api://256f294a-d776-4146-b9ca-b5c4c63e38b8/access_as_user';

export const msalConfig = {
  auth: {
    clientId: 'd9b4ac02-6344-48d8-ba56-35440eacb87c',
    authority: 'https://login.microsoftonline.com/50987723-089c-4588-bcd2-1e3af905d437',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  }
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const msalGuardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Redirect,
  authRequest: {
    scopes: ['user.read', apiScope]
  },
  loginFailedRoute: '/login-failed'
};

export const msalInterceptorConfig: MsalInterceptorConfiguration = {
  interactionType: InteractionType.Redirect,
  protectedResourceMap: new Map([
    // ─── Microsoft Graph ────────────────────────────────────────────────────
    ['https://graph.microsoft.com/v1.0/me', ['user.read']],

    // ─── LexiAI Backend (local) ─────────────────────────────────────────────
    ['http://localhost:5095', [apiScope]],

    // ─── LexiAI Backend (production) ────────────────────────────────────────
    ['https://your-azure-api-url.azurewebsites.net', [apiScope]],
  ])
};