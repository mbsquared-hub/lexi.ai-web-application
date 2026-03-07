import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { EventMessage, EventType, AuthenticationResult } from '@azure/msal-browser';
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
        }
      });
    });

    this.msalBroadcastService.msalSubject$
      .pipe(
        filter((e: EventMessage) => e.eventType === EventType.LOGIN_SUCCESS),
        takeUntil(this.destroying$)
      )
      .subscribe((e: EventMessage) => {
        const result = e.payload as AuthenticationResult;
        this.msalService.instance.setActiveAccount(result.account);
      });
  }

  ngOnDestroy() {
    this.destroying$.next(undefined);
    this.destroying$.complete();
  }
}