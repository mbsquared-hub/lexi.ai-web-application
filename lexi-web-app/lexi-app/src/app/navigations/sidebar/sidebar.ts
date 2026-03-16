import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarService } from '../../services/sidebar.service';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule,],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})

export class Sidebar {
  constructor(
    public sidebarService: SidebarService, 
    public themeService: ThemeService,
    public authService: AuthService
  ){}

  userrole = 'User';

  chats = [
    { id: 1, title: 'AZ-900 Exam Topics' },
    { id: 2, title: 'Exam Preparation Tips' },
    { id: 3, title: 'Study Resources' },
  ];

  @Output() deleteModalOpen = new EventEmitter<number>();
  @Output() logoutModalOpen = new EventEmitter<void>(); 
  @Output() openChatHistory = new EventEmitter<void>();  
  @Output() newChat = new EventEmitter<void>();
  @Input() isChatHistoryOpen = false;

  openDeleteModal(id: number) {
    this.deleteModalOpen.emit(id);
  }

  @Input() chatToDelete: number | null = null;

  deleteChat(id: number) {
    this.chats = this.chats.filter(chat => chat.id !== id);
  }

  toggleSidebar() {
    if (this.sidebarService.isOpen()) {
    }
    this.sidebarService.toggle();
  }

  get username(): string {
    return this.authService.getUserName() || 'User';
  }

  get userEmail(): string {
    return this.authService.getUserEmail() || '';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  
  openLogoutModal() {
    this.logoutModalOpen.emit();
  }
}