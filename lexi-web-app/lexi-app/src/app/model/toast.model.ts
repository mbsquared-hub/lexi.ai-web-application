export type ToastType = 'info' | 'default' | 'warning' | 'error' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number; 
}
