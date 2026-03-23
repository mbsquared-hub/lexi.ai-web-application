import { Component, ChangeDetectorRef, ElementRef, ViewChild, NgZone, inject, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { ConversationService } from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';
import { Message } from '../../model/message.model';
import { ConversationDto } from '../../model/conversation.model';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit {
  messages: Message[] = [];
  inputText = '';
  isWelcome = true;
  isLoading = false;
  isLoadingHistory = false;
  previewImages: string[] = [];
  maxImages = 5;
  viewerImage: string | null = null;
  currentConversationId: string | null = null;

  private pendingImages: string[] = [];

  @Output() conversationUpdated = new EventEmitter<void>();

  private toastService = inject(ToastService);
  private conversationService = inject(ConversationService);
  private authService = inject(AuthService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public themeService: ThemeService
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.toastService.warning('Not logged in', 'Please log in to use Lexi.');
    }
  }

  // ─── Auto Scroll ──────────────────────────────────────────────────────────
  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  }

  // ─── File / Image Handling ────────────────────────────────────────────────

  openFilePicker() {
    if (this.previewImages.length >= this.maxImages) return;
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
      const remaining = this.maxImages - this.previewImages.length;
      Array.from(files).slice(0, remaining).forEach(file => this.loadImage(file));
    }
    (event.target as HTMLInputElement).value = '';
  }

  loadImage(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (this.previewImages.length >= this.maxImages) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.ngZone.run(() => {
        this.previewImages.push(e.target?.result as string);
        this.cdr.detectChanges();
      });
    };
    reader.readAsDataURL(file);
  }

  onPaste(event: ClipboardEvent) {
    if (this.previewImages.length >= this.maxImages) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) this.loadImage(file);
        return;
      }
    }
  }

  removePreview(index: number) {
    this.previewImages.splice(index, 1);
    this.cdr.detectChanges();
  }

  openViewer(image: string) {
    this.viewerImage = image;
    this.cdr.detectChanges();
  }

  closeViewer() {
    this.viewerImage = null;
    this.cdr.detectChanges();
  }

  selectSuggestion(text: string) {
    this.inputText = text;
    this.sendMessage();
  }

  // ─── Send Message ─────────────────────────────────────────────────────────

  sendMessage() {
    const text = this.inputText.trim();
    if (!text && this.previewImages.length === 0) return;
    if (this.isLoading) return;

    this.isWelcome = false;
    this.isLoading = true;

    // ← use default prompt when only images sent
    const messageText = text || 'What is this image?';

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text, // ← keep empty in UI so bubble shows image only
      images: [...this.previewImages]
    };
    this.messages.push(userMessage);

    this.pendingImages = [...this.previewImages];
    this.inputText = '';
    this.previewImages = [];
    this.cdr.detectChanges();
    this.scrollToBottom();

    if (!this.currentConversationId) {
      this.conversationService.createConversation({
        title: text || 'Image analysis' // ← better title for image-only
      }).subscribe({
        next: (conversation: ConversationDto) => {
          this.currentConversationId = conversation.id;
          this.conversationUpdated.emit();
          this.cdr.detectChanges();
          setTimeout(() => this.sendToBackend(messageText), 50);
        },
        error: (err) => {
          this.handleError('Failed to create conversation', err);
        }
      });
    } else {
      this.cdr.detectChanges();
      setTimeout(() => this.sendToBackend(messageText), 50);
    }
  }

  private sendToBackend(message: string) {
    const images = [...this.pendingImages];
    this.pendingImages = [];

    this.conversationService.sendMessage(this.currentConversationId!, message, images)
      .subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.messages.push({
              id: crypto.randomUUID(),
              role: 'lexi',
              content: response.aiReply,
              timestamp: new Date(response.timestamp)
            });
            this.isLoading = false;
            this.conversationUpdated.emit();
            this.cdr.detectChanges();
            this.scrollToBottom();
          });
        },
        error: (err) => {
          this.handleError('Lexi could not respond', err);
        }
      });
  }

  // ─── Regenerate ───────────────────────────────────────────────────────────

  regenerate() {
    if (!this.currentConversationId || this.isLoading) return;

    const lastUserMessage = [...this.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    const lastLexiIndex = [...this.messages].map(m => m.role).lastIndexOf('lexi');
    if (lastLexiIndex !== -1) {
      this.messages.splice(lastLexiIndex, 1);
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    setTimeout(() => this.sendToBackend(lastUserMessage.content), 50);
  }

  // ─── Load Existing Conversation ───────────────────────────────────────────

  loadConversation(conversationId: string) {
    this.currentConversationId = conversationId;
    this.isWelcome = false;
    this.messages = [];
    this.isLoading = false;
    this.isLoadingHistory = true;
    this.pendingImages = [];
    this.cdr.detectChanges();

    this.conversationService.getChatHistory(conversationId)
      .subscribe({
        next: (responses) => {
          this.ngZone.run(() => {
            responses.forEach(r => {
              this.messages.push({
                id: crypto.randomUUID(),
                role: 'user',
                content: r.userMessage,
                timestamp: new Date(r.createdAt)
              });
              this.messages.push({
                id: crypto.randomUUID(),
                role: 'lexi',
                content: r.aiMessage,
                timestamp: new Date(r.createdAt)
              });
            });
            this.isLoadingHistory = false;
            this.cdr.detectChanges();
            this.scrollToBottom();
          });
        },
        error: (err) => {
          this.isLoadingHistory = false;
          this.handleError('Failed to load conversation', err);
        }
      });
  }

  // ─── New Chat ─────────────────────────────────────────────────────────────

  newChat() {
    this.currentConversationId = null;
    this.messages = [];
    this.isWelcome = true;
    this.isLoading = false;
    this.isLoadingHistory = false;
    this.inputText = '';
    this.previewImages = [];
    this.pendingImages = [];
    this.cdr.detectChanges();
  }

  // ─── Error Handling ───────────────────────────────────────────────────────

  private handleError(message: string, err: unknown) {
    console.error(message, err);
    this.isLoading = false;
    this.isLoadingHistory = false;
    this.pendingImages = [];
    this.toastService.error(message, 'Please try again.');
    this.cdr.detectChanges();
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}