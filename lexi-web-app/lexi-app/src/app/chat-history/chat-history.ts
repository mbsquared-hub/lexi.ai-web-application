import { Component, Output, EventEmitter, HostListener, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Modal } from '../modal/modal';
import { ToastService } from '../services/toast.service';
import { ConversationService } from '../services/conversation.service';
import { ConversationDto } from '../model/conversation.model';

@Component({
  selector: 'app-chat-history',
  imports: [CommonModule, FormsModule, Modal],
  templateUrl: './chat-history.html',
  styleUrl: './chat-history.scss',
})
export class ChatHistory implements OnInit {
  @Output() back = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() conversationSelected = new EventEmitter<string>();

  private toastService = inject(ToastService);
  private conversationService = inject(ConversationService);
  private cdr = inject(ChangeDetectorRef);

  selectMode = false;
  showDeleteModal = false;
  conversationToDelete: ConversationDto | null = null;

  isLoading = false;
  searchText = '';

  renamingId: string | null = null;
  renameValue = '';
  isCancelling = false; // ← prevents blur from triggering confirmRename

  conversations: ConversationDto[] = [];
  uiState: Record<string, { selected: boolean; showDropdown: boolean }> = {};

  ngOnInit() {
    this.loadConversations();
  }

  // ─── Load ─────────────────────────────────────────────────────────────────
  loadConversations() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.conversationService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        this.conversations.forEach(c => {
          if (!this.uiState[c.id]) {
            this.uiState[c.id] = { selected: false, showDropdown: false };
          }
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load conversations', err);
        this.toastService.error('Failed to load history', 'Please try again.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── Filtered list ────────────────────────────────────────────────────────
  get filteredConversations(): ConversationDto[] {
    if (!this.searchText.trim()) return this.conversations;
    const q = this.searchText.toLowerCase();
    return this.conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.lastMessagePreview?.toLowerCase().includes(q)
    );
  }

  // ─── Selection ────────────────────────────────────────────────────────────
  get selectedCount(): number {
    return Object.values(this.uiState).filter(s => s.selected).length;
  }

  get allSelected(): boolean {
    return this.conversations.length > 0 &&
      this.conversations.every(c => this.uiState[c.id]?.selected);
  }

  enterSelectMode() { this.selectMode = true; }

  exitSelectMode() {
    this.selectMode = false;
    this.clearSelection();
  }

  onCheckboxChange() {
    this.selectMode = this.selectedCount > 0;
    this.cdr.detectChanges();
  }

  toggleSelectAll() {
    const selectAll = !this.allSelected;
    this.conversations.forEach(c => {
      if (this.uiState[c.id]) this.uiState[c.id].selected = selectAll;
    });
    this.cdr.detectChanges();
  }

  clearSelection() {
    Object.values(this.uiState).forEach(s => s.selected = false);
    this.cdr.detectChanges();
  }

  // ─── Select from dropdown ─────────────────────────────────────────────────
  onSelect(conversation: ConversationDto, event: Event) {
    event.stopPropagation();
    this.selectMode = true;
    this.uiState[conversation.id].selected = true;
    this.uiState[conversation.id].showDropdown = false;
    this.cdr.detectChanges();
  }

  // ─── Open conversation ────────────────────────────────────────────────────
  openConversation(conversation: ConversationDto) {
    if (this.renamingId === conversation.id) return;
    if (this.isCancelling) return; // ← block open if cancelling rename
    if (this.selectMode) {
      this.uiState[conversation.id].selected = !this.uiState[conversation.id].selected;
      this.onCheckboxChange();
      return;
    }
    this.conversationSelected.emit(conversation.id);
  }

  // ─── Dropdown ─────────────────────────────────────────────────────────────
  toggleDropdown(conversation: ConversationDto, event: Event) {
    event.stopPropagation();
    const wasOpen = this.uiState[conversation.id].showDropdown;
    this.closeAllDropdowns();
    this.uiState[conversation.id].showDropdown = !wasOpen;
    this.cdr.detectChanges();
  }

  closeAllDropdowns() {
    Object.values(this.uiState).forEach(s => s.showDropdown = false);
    this.cdr.detectChanges();
  }

  // ─── Rename ───────────────────────────────────────────────────────────────
  startRename(conversation: ConversationDto, event: Event) {
    event.stopPropagation();
    this.closeAllDropdowns();
    this.selectMode = false;
    this.isCancelling = false;
    this.renamingId = conversation.id;
    this.renameValue = conversation.title;
    this.cdr.detectChanges();
    setTimeout(() => {
      const input = document.querySelector('.rename-input') as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 50);
  }

  confirmRename(conversation: ConversationDto) {
    if (this.isCancelling) return; // ← skip if cancel button was clicked
    const trimmed = this.renameValue.trim();
    if (!trimmed || trimmed === conversation.title) {
      this.cancelRename();
      return;
    }
    this.conversationService.updateConversation(conversation.id, { title: trimmed })
      .subscribe({
        next: (updated) => {
          const index = this.conversations.findIndex(c => c.id === conversation.id);
          if (index !== -1) this.conversations[index] = updated;
          this.toastService.success('Renamed', `Conversation renamed to "${trimmed}"`);
          this.cancelRename();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Rename failed', err);
          this.toastService.error('Rename failed', 'Please try again.');
          this.cancelRename();
        }
      });
  }

  cancelRename() {
    this.isCancelling = true;
    this.renamingId = null;
    this.renameValue = '';
    this.cdr.detectChanges();
    // reset flag after change detection cycle
    setTimeout(() => {
      this.isCancelling = false;
    }, 100);
  }

  onRenameKeyDown(event: KeyboardEvent, conversation: ConversationDto) {
    event.stopPropagation();
    if (event.key === 'Enter') this.confirmRename(conversation);
    if (event.key === 'Escape') this.cancelRename();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  deleteConversation(conversation: ConversationDto, event: Event) {
    event.stopPropagation();
    this.conversationToDelete = conversation;
    this.showDeleteModal = true;
    this.closeAllDropdowns();
  }

  deleteSelected() {
    this.conversationToDelete = null;
    this.showDeleteModal = true;
  }

  onDeleteConfirmed() {
    if (this.conversationToDelete) {
      const id = this.conversationToDelete.id;
      const title = this.conversationToDelete.title;
      this.conversationService.deleteConversation(id).subscribe({
        next: () => {
          this.conversations = this.conversations.filter(c => c.id !== id);
          delete this.uiState[id];
          this.toastService.success(`"${title}" deleted`, 'The conversation has been deleted.');
          this.conversationToDelete = null;
          this.showDeleteModal = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Delete failed', err);
          this.toastService.error('Delete failed', 'Please try again.');
          this.showDeleteModal = false;
        }
      });
    } else {
      const toDelete = this.conversations.filter(c => this.uiState[c.id]?.selected);
      const count = toDelete.length;
      let completed = 0;
      toDelete.forEach(c => {
        this.conversationService.deleteConversation(c.id).subscribe({
          next: () => {
            this.conversations = this.conversations.filter(x => x.id !== c.id);
            delete this.uiState[c.id];
            completed++;
            if (completed === count) {
              this.toastService.success(
                count === 1 ? `"${toDelete[0].title}" deleted` : `${count} conversations deleted`,
                'Successfully deleted.'
              );
              this.exitSelectMode();
              this.showDeleteModal = false;
              this.cdr.detectChanges();
            }
          },
          error: (err) => {
            console.error('Bulk delete failed', err);
            this.toastService.error('Delete failed', 'Please try again.');
            this.showDeleteModal = false;
          }
        });
      });
    }
  }

  onDeleteCancelled() {
    this.conversationToDelete = null;
    this.showDeleteModal = false;
  }

  // ─── Format date ──────────────────────────────────────────────────────────
  formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeAllDropdowns();
  }
}