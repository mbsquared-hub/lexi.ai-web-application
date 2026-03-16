import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastNotificationComponent } from './toast-notification/toast-notification';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, ToastNotificationComponent],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <app-toast-notification [toast]="toast" (dismiss)="toastService.dismiss($event)" />
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 100px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 380px;
      max-width: calc(100vw - 48px);
      pointer-events: none;
    }
    .toast-container > * {
      pointer-events: all;
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}