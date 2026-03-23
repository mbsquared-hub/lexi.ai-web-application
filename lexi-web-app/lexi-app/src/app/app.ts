import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { EventMessage, EventType, AuthenticationResult, InteractionStatus } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private readonly destroying$ = new Subject<void>();

  constructor(
    private msalService: MsalService,
    private msalBroadcastService: MsalBroadcastService
  ) {}

  ngOnInit() {
    this.msalService.instance.initialize().then(() => {
      this.msalService.instance.handleRedirectPromise().then((result) => {
        if (result) {
          this.msalService.instance.setActiveAccount(result.account);
        } else {
          // ← KEY FIX: user already logged in from previous session
          const accounts = this.msalService.instance.getAllAccounts();
          if (accounts.length > 0) {
            this.msalService.instance.setActiveAccount(accounts[0]);
          }
        }
      });
    });

    // ─── Set active account on fresh login ─────────────────────────────────
    this.msalBroadcastService.msalSubject$
      .pipe(
        filter((e: EventMessage) => e.eventType === EventType.LOGIN_SUCCESS),
        takeUntil(this.destroying$)
      )
      .subscribe((e: EventMessage) => {
        const result = e.payload as AuthenticationResult;
        this.msalService.instance.setActiveAccount(result.account);
      });

    // ─── Ensure active account is set after any interaction completes ───────
    this.msalBroadcastService.inProgress$
      .pipe(
        filter((status) => status === InteractionStatus.None),
        takeUntil(this.destroying$)
      )
      .subscribe(() => {
        const accounts = this.msalService.instance.getAllAccounts();
        if (accounts.length > 0 && !this.msalService.instance.getActiveAccount()) {
          this.msalService.instance.setActiveAccount(accounts[0]);
        }
      });
  }

  ngOnDestroy() {
    this.destroying$.next(undefined);
    this.destroying$.complete();
  }
}