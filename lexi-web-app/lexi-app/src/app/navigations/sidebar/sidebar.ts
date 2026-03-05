import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarService } from '../../services/sidebar.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  constructor(
    public sidebarService: SidebarService, 
    public themeService: ThemeService) {}

    username = 'Jane Doe';
    userrole = 'User';
    dropdownOpen = false;

  chats = [
    { id: 1, title: 'AZ-900 Exam Topics' },
    { id: 2, title: 'Exam Preparation Tips' },
    { id: 3, title: 'Study Resources' },
  ];

  @Output() deleteModalOpen = new EventEmitter<number>();

  openDeleteModal(id: number) {
    this.deleteModalOpen.emit(id);
  }

  @Input() chatToDelete: number | null = null;

  deleteChat(id: number) {
    this.chats = this.chats.filter(chat => chat.id !== id);
  }

  toggleSidebar() {
    if (this.sidebarService.isOpen()) {
      this.dropdownOpen = false;
    }
    this.sidebarService.toggle();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  logout() {
    console.log('User logged out');
  }
}