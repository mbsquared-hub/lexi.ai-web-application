import { Injectable } from '@angular/core';
import { MsalService } from '@azure/msal-angular';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private msal: MsalService) {}

  login() {
    this.msal.loginRedirect({
      scopes: ['user.read']
    });
  }

  loginWithGoogle() {
    this.msal.loginRedirect({
      scopes: ['user.read'],
      extraQueryParameters: { domain_hint: 'google.com' }
    });
  }

  logout() {
    this.msal.logoutRedirect({
      postLogoutRedirectUri: window.location.origin
    });
  }

  getUser() {
    return this.msal.instance.getActiveAccount()
    ?? this.msal.instance.getAllAccounts()?.[0]
    ?? null;
  }

  isLoggedIn(): boolean {
    return this.msal.instance.getAllAccounts().length > 0;
  }

  getUserName(): string {
    return this.getUser()?.name || '';
  }

  getUserEmail(): string {
    return this.getUser()?.username || '';
  }
}