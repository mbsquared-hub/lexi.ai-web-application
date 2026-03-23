import { Injectable } from '@angular/core';
import {
  HttpRequest, HttpHandler, HttpEvent, HttpInterceptor
} from '@angular/common/http';
import { Observable, from, switchMap, catchError, throwError } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { environment } from '../../environments/environment';

const API_SCOPE = 'api://256f294a-d776-4146-b9ca-b5c4c63e38b8/access_as_user';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private msalService: MsalService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith(environment.apiUrl)) {
      return next.handle(req);
    }

    const account = this.msalService.instance.getActiveAccount()
      ?? this.msalService.instance.getAllAccounts()[0];

    if (!account) {
      return next.handle(req);
    }

    return from(
      this.msalService.instance.acquireTokenSilent({
        scopes: [API_SCOPE],
        account,
        forceRefresh: false
      })
    ).pipe(
      switchMap(result => {
        console.log('✅ Token acquired, attaching Bearer');
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${result.accessToken}`
          }
        });
        return next.handle(authReq);
      }),
      catchError(error => {
        console.error('❌ Token acquisition failed:', error);

        // If interaction is required, trigger redirect login
        if (error instanceof InteractionRequiredAuthError) {
          console.warn('Interaction required — redirecting to login');
          this.msalService.instance.acquireTokenRedirect({
            scopes: [API_SCOPE],
            account
          });
        }

        return throwError(() => error);
      })
    );
  }
}