import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  isOpen = signal<boolean>(false); // ← change true to false
  toggle() { this.isOpen.set(!this.isOpen()); }
}