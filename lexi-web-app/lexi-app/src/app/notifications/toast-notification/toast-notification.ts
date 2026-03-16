import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastType, Toast} from '../../model/toast.model';

@Component({
  selector: 'app-toast-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-notification.html',
  styleUrl: './toast-notification.scss',
  encapsulation: ViewEncapsulation.None  
})

export class ToastNotificationComponent implements OnInit, OnDestroy {
  @Input({ required: true }) toast!: Toast;
  @Output() dismiss = new EventEmitter<string>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  get bgClass(): string {
    const map: Record<ToastType, string> = {
      info:    'bg-info',
      default: 'bg-default',
      warning: 'bg-warning',
      error:   'bg-error',
      success: 'bg-success',
    };
    return map[this.toast.type];
  }

  get iconBgClass(): string {
    const map: Record<ToastType, string> = {
      info:    'icon-info',
      default: 'icon-default',
      warning: 'icon-warning',
      error:   'icon-error',
      success: 'icon-success',
    };
    return map[this.toast.type];
  }

  ngOnInit(): void {
    const duration = this.toast.duration ?? 5000;
    if (duration > 0) {
      this.timer = setTimeout(() => this.onDismiss(), duration);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  onDismiss(): void {
    this.dismiss.emit(this.toast.id);
  }
}