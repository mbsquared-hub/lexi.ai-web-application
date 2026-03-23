import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalService,
} from '@azure/msal-angular';
import { routes } from './app.routes';
import { msalGuardConfig, msalInstance, msalInterceptorConfig } from './auth.config';
import { AuthInterceptor } from './services/auth.interceptor';
import { provideMarkdown } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideMarkdown(),

    // ─── MSAL ──────────────────────────────────────────────────────────────
    { provide: MSAL_INSTANCE, useValue: msalInstance },
    { provide: MSAL_GUARD_CONFIG, useValue: msalGuardConfig },
    { provide: MSAL_INTERCEPTOR_CONFIG, useValue: msalInterceptorConfig },
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },

    // ─── Auth Interceptor (fallback / extra headers) ────────────────────────
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

    // ─── MSAL Services ─────────────────────────────────────────────────────
    MsalService,
    MsalGuard,
    MsalBroadcastService,
  ]
};