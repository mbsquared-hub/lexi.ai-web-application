import { Component, ChangeDetectorRef, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';

interface Message {
  id: number;
  role: 'user' | 'lexi';
  content: string;
  images?: string[];
}

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  messages: Message[] = [];
  inputText = '';
  isWelcome = true;
  previewImages: string[] = [];
  maxImages = 5;
  viewerImage: string | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone, public themeService: ThemeService) {}

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
      this.ngZone.run(() => { // ← runs inside Angular's zone
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
    this.cdr.detectChanges();
  }

  sendMessage() {
    const text = this.inputText.trim();
    if (!text && this.previewImages.length === 0) return;

    this.isWelcome = false;
    this.messages.push({
      id: Date.now(),
      role: 'user',
      content: text,
      images: [...this.previewImages]
    });

    this.inputText = '';
    this.previewImages = [];
    this.cdr.detectChanges();

    setTimeout(() => {
      this.messages.push({
        id: Date.now() + 1,
        role: 'lexi',
        content: "Hi! Thanks for your message. I'm currently not connected to Azure OpenAI yet."
      });
      this.cdr.detectChanges();
    }, 600);
  }

  regenerate() {
    const lastLexi = [...this.messages].reverse().find(m => m.role === 'lexi');
    if (lastLexi) {
      lastLexi.content = "Hi! Thanks for your message. I'm currently not connected to Azure OpenAI yet.";
      this.cdr.detectChanges();
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}