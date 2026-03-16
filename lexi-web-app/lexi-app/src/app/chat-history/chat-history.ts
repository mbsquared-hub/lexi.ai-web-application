import { Component, Output, EventEmitter, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Modal } from '../modal/modal'; 
import { ToastService } from '../services/toast.service'; 
import { Chat } from '../model/chat.model';

@Component({
  selector: 'app-chat-history',
  imports: [CommonModule, FormsModule, Modal],
  templateUrl: './chat-history.html',
  styleUrl: './chat-history.scss',
})
export class ChatHistory {
  @Output() back = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();

  private toastService = inject(ToastService);

  selectMode = false;
  showDeleteModal = false;
  chatToDelete: Chat | null = null;

  //will update according to the user's history
  chats: Chat[] = [
    { title: 'Toast notification UI examples', lastMessage: 'Last message 29 minutes ago', selected: false, showDropdown: false },
    { title: 'Angular click handler not navigating to URL', lastMessage: 'Last message 2 hours ago', selected: false, showDropdown: false },
    { title: 'Automatic group assignment for external users', lastMessage: 'Last message 6 hours ago', selected: false, showDropdown: false },
    { title: 'How compound interest works', lastMessage: 'Last message 20 hours ago', selected: false, showDropdown: false },
    { title: 'Creating resource groups and location considerations', lastMessage: 'Last message 5 days ago', selected: false, showDropdown: false },
    { title: 'Building an AI certification helper backend', lastMessage: 'Last message 5 days ago', selected: false, showDropdown: false },
  ];

  get selectedCount(): number {
    return this.chats.filter(c => c.selected).length;
  }

  get allSelected(): boolean {
    return this.chats.every(c => c.selected);
  }

  enterSelectMode() {
    this.selectMode = true;
  }

  exitSelectMode() {
    this.selectMode = false;
    this.clearSelection();
  }

  onCheckboxChange() {
    this.selectMode = this.selectedCount > 0;
  }

  toggleSelectAll() {
    const selectAll = !this.allSelected;
    this.chats.forEach(c => c.selected = selectAll);
  }

  clearSelection() {
    this.chats.forEach(c => c.selected = false);
  }

  toggleDropdown(chat: Chat, event: Event) {
    event.stopPropagation();
    const wasOpen = chat.showDropdown;
    this.closeAllDropdowns();
    chat.showDropdown = !wasOpen;
  }

  closeAllDropdowns() {
    this.chats.forEach(c => c.showDropdown = false);
  }

  onSelect(chat: Chat) {
    this.selectMode = true;
    chat.selected = true;
    chat.showDropdown = false;
  }

  deleteChat(chat: Chat) {
    this.chatToDelete = chat;
    this.showDeleteModal = true;
    this.closeAllDropdowns();
  }

  deleteSelected() {
    this.chatToDelete = null;
    this.showDeleteModal = true;
  }

  onDeleteConfirmed() {
    if (this.chatToDelete) {
      // Single delete from dropdown
      const title = this.chatToDelete.title;
      this.chats = this.chats.filter(c => c !== this.chatToDelete);
      this.toastService.success(
        `"${title}" deleted`,
        'The chat has been successfully deleted.'
      );
      this.chatToDelete = null;
    } else {
      // Bulk delete from selection bar
      const count = this.selectedCount;
      const titles = this.chats
        .filter(c => c.selected)
        .map(c => c.title);

      this.chats = this.chats.filter(c => !c.selected);

      this.toastService.success(
        count === 1 ? `"${titles[0]}" deleted` : `${count} chats deleted`,
        count === 1
          ? 'The chat has been successfully deleted.'
          : `${count} chats have been successfully deleted.`
      );
      this.exitSelectMode();
    }
    this.showDeleteModal = false;
  }

  onDeleteCancelled() {
    this.chatToDelete = null;
    this.showDeleteModal = false;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeAllDropdowns();
  }
}