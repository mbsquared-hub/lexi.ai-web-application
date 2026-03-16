import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '../model/toast.model';

@Injectable({ providedIn: 'root' })

export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, title: string, description?: string, duration = 5000): string {
    const id = crypto.randomUUID();
    this._toasts.update(list => [...list, { id, type, title, description, duration }]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  info(title: string, description?: string, duration?: number) {
    return this.show('info', title, description, duration);
  }

  default(title: string, description?: string, duration?: number) {
    return this.show('default', title, description, duration);
  }

  warning(title: string, description?: string, duration?: number) {
    return this.show('warning', title, description, duration);
  }

  error(title: string, description?: string, duration?: number) {
    return this.show('error', title, description, duration);
  }

  success(title: string, description?: string, duration?: number) {
    return this.show('success', title, description, duration);
  }

  dismiss(id: string) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clear() {
    this._toasts.set([]);
  }
}