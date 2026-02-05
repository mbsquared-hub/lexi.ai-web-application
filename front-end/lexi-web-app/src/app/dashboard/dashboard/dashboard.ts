import { Component, PLATFORM_ID, Inject, ChangeDetectorRef, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Message {
  text: string;
  sender: 'user' | 'lexi';
  timestamp: Date;
  images?: string[]; // Array of base64 image data
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  messages: Message[] = [];
  userInput = '';
  isTyping = false;
  private isBrowser: boolean;
  private pasteListener?: (event: ClipboardEvent) => void;
  
  // Image preview/staging - now supports multiple images
  stagedImages: string[] = [];
  showImagePreview = false;
  readonly MAX_IMAGES = 5;

  // Conversation history for future AI integration
  private conversationHistory: Array<{role: string, content: string}> = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      // Clear any persisted data on init (safe to do here)
      localStorage.removeItem('lexi_conversation');
      this.setupPasteListener();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser && this.pasteListener) {
      document.removeEventListener('paste', this.pasteListener);
    }
  }

  /**
   * Getter for template: checks if there are images
   */
  get hasImages(): boolean {
    return this.showImagePreview && this.stagedImages.length > 0;
  }

  /**
   * Getter for template: checks if upload is disabled
   */
  get isUploadDisabled(): boolean {
    return this.stagedImages.length >= this.MAX_IMAGES;
  }

  /**
   * Getter for template: dynamic placeholder text
   */
  get inputPlaceholder(): string {
    if (this.showImagePreview && this.stagedImages.length > 0) {
      const imageText = this.stagedImages.length > 1 ? 'these images' : 'this image';
      return `Ask a question about ${imageText}...`;
    }
    return 'Ask Lexi about anything....';
  }

  /**
   * Sets up paste event listener for screenshots
   */
  private setupPasteListener(): void {
    this.pasteListener = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          event.preventDefault();
          
          const blob = items[i].getAsFile();
          if (blob) {
            this.addImageToStaging(blob);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', this.pasteListener);
  }

  /**
   * Add an image to staging area
   */
  private addImageToStaging(blob: Blob): void {
    // Check if we've reached the limit
    if (this.stagedImages.length >= this.MAX_IMAGES) {
      alert(`You can only upload up to ${this.MAX_IMAGES} images at a time.`);
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e: any) => {
      this.ngZone.run(() => {
        this.stagedImages.push(e.target.result);
        this.showImagePreview = true;
        this.cdr.detectChanges();
        
        // Focus on the input field
        setTimeout(() => {
          const input = document.querySelector('.chat-input') as HTMLInputElement;
          if (input) {
            input.focus();
          }
        }, 100);
      });
    };
    
    reader.readAsDataURL(blob);
  }

  /**
   * Handle file upload from file input
   */
  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (this.stagedImages.length + files.length > this.MAX_IMAGES) {
      alert(`You can only upload up to ${this.MAX_IMAGES} images at a time. You currently have ${this.stagedImages.length} image(s) staged.`);
      event.target.value = '';
      return;
    }

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`File "${file.name}" is not an image. Skipping.`);
        continue;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`Image "${file.name}" must be less than 10MB. Skipping.`);
        continue;
      }

      this.addImageToStaging(file);
    }

    // Reset file input
    event.target.value = '';
  }

  /**
   * Remove a specific image from staging
   */
  removeImage(index: number): void {
    this.stagedImages.splice(index, 1);
    
    // Hide preview if no images left
    if (this.stagedImages.length === 0) {
      this.showImagePreview = false;
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Cancel all staged images
   */
  cancelAllImages(): void {
    this.stagedImages = [];
    this.showImagePreview = false;
    this.cdr.detectChanges();
  }

  /**
   * Formats message text with markdown-style syntax to HTML
   */
  formatMessage(text: string): SafeHtml {
    if (!text) return '';

    let formatted = this.applyInlineFormatting(text);
    const htmlLines = this.parseLines(formatted.split('\n'));
    
    return this.sanitizer.bypassSecurityTrustHtml(htmlLines.join(''));
  }

  /**
   * Applies inline markdown formatting (bold, italic, code)
   */
  private applyInlineFormatting(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // **bold**
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')  // *italic*
      .replace(/`([^`]+)`/g, '<code>$1</code>');  // `code`
  }

  /**
   * Parses lines and converts to proper HTML structure with lists and paragraphs
   */
  private parseLines(lines: string[]): string[] {
    const result: string[] = [];
    let inOrderedList = false;
    let inUnorderedList = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        this.closeUnorderedList(result, inUnorderedList);
        inUnorderedList = false;
        continue;
      }

      // Handle numbered lists (1. 2. 3.)
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        inUnorderedList = this.closeUnorderedList(result, inUnorderedList);
        inOrderedList = this.openOrderedList(result, inOrderedList);
        result.push(`<li>${numberedMatch[2]}`);
        continue;
      }

      // Handle bullet points (-, •, *)
      const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
      if (bulletMatch) {
        inUnorderedList = this.openUnorderedList(result, inUnorderedList);
        result.push(`<li>${bulletMatch[1]}</li>`);
        continue;
      }

      // Regular paragraph
      if (inUnorderedList) {
        result.push('</ul>', '</li>');
        inUnorderedList = false;
      }
      
      if (inOrderedList && !numberedMatch) {
        result.push('</ol>');
        inOrderedList = false;
      }
      
      result.push(`<p>${trimmedLine}</p>`);
    }

    // Close any remaining open lists
    if (inUnorderedList) {
      result.push('</ul>', '</li>');
    }
    if (inOrderedList) {
      result.push('</ol>');
    }

    return result;
  }

  private openOrderedList(result: string[], isOpen: boolean): boolean {
    if (!isOpen) {
      result.push('<ol>');
      return true;
    }
    return isOpen;
  }

  private openUnorderedList(result: string[], isOpen: boolean): boolean {
    if (!isOpen) {
      result.push('<ul>');
      return true;
    }
    return isOpen;
  }

  private closeUnorderedList(result: string[], isOpen: boolean): boolean {
    if (isOpen) {
      result.push('</ul>');
      return false;
    }
    return isOpen;
  }

  /**
   * Sends user message and processes it
   */
  sendMessage(): void {
    const trimmedInput = this.userInput.trim();
    
    // If there are staged images, send them with the message
    if (this.stagedImages.length > 0) {
      this.sendImagesWithMessage();
      return;
    }

    // For text-only messages, require non-empty input
    if (!trimmedInput) return;

    this.addMessage(trimmedInput, 'user');
    this.addToConversationHistory('user', trimmedInput);
    this.userInput = '';
    this.setTypingState(true);

    // INSTANT response - no delay
    this.simulateAIResponse(trimmedInput);
  }

  /**
   * Send staged images with optional message
   */
  private sendImagesWithMessage(): void {
    if (this.stagedImages.length === 0) return;

    const images = [...this.stagedImages]; // Copy array
    const prompt = this.userInput.trim() || `Please analyze these ${images.length} image${images.length > 1 ? 's' : ''} and help me understand them for my exam preparation.`;
    
    // Add user message with images to chat
    this.addMessage(prompt, 'user', images);
    this.addToConversationHistory('user', `[${images.length} image(s) uploaded] ${prompt}`);
    
    // Clear input and staged images
    this.userInput = '';
    this.stagedImages = [];
    this.showImagePreview = false;
    
    this.setTypingState(true);

    // INSTANT response - no delay
    this.simulateImageAnalysisResponse(prompt, images.length);
  }

  /**
   * Simulates AI response INSTANTLY (placeholder for future AI integration)
   */
  private simulateAIResponse(userMessage: string): void {
    // INSTANT response - using requestAnimationFrame for smooth UI update
    requestAnimationFrame(() => {
      const response = this.generatePlaceholderResponse(userMessage);
      
      this.ngZone.run(() => {
        this.setTypingState(false);
        this.addMessage(response, 'lexi');
        this.addToConversationHistory('assistant', response);
      });
    });
  }

  /**
   * Simulates image analysis response INSTANTLY
   */
  private simulateImageAnalysisResponse(prompt: string, imageCount: number): void {
    // INSTANT response - using requestAnimationFrame for smooth UI update
    requestAnimationFrame(() => {
      const imageText = imageCount === 1 ? 'image' : `${imageCount} images`;
      const response = `Hi! Thanks for your message. I'm currently not connected to Azure OpenAI yet hence I'll review the ${imageText} later once connected.`;
      
      this.ngZone.run(() => {
        this.setTypingState(false);
        this.addMessage(response, 'lexi');
        this.addToConversationHistory('assistant', response);
      });
    });
  }

  /**
   * Generates a placeholder response based on user input
   * This will be replaced with actual AI integration later
   */
  private generatePlaceholderResponse(userMessage: string): string {
    return `Hi! Thanks for your message. I'm currently not connected to Azure OpenAI yet.`;
  }

  /**
   * Handles keyboard events in input field
   */
  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Selects a suggestion and sends it as a message
   */
  selectSuggestion(suggestion: string): void {
    this.userInput = suggestion;
    this.sendMessage();
  }

  /**
   * Regenerates the last AI response
   */
  regenerateResponse(): void {
    if (this.messages.length === 0 || this.isTyping) return;

    const lastUserMessageIndex = this.findLastUserMessageIndex();
    if (lastUserMessageIndex === -1) return;

    // Get the last user message
    const lastUserMessage = this.messages[lastUserMessageIndex].text;
    const lastUserImages = this.messages[lastUserMessageIndex].images;

    // Remove messages after the last user message
    this.messages = this.messages.slice(0, lastUserMessageIndex + 1);
    
    // Update conversation history
    this.conversationHistory = this.conversationHistory.slice(0, (lastUserMessageIndex + 1) * 2);
    
    // Resend the last user message
    this.setTypingState(true);

    // If it was an image message, regenerate image response
    if (lastUserImages && lastUserImages.length > 0) {
      this.simulateImageAnalysisResponse(lastUserMessage, lastUserImages.length);
    } else {
      // Text only message
      this.simulateAIResponse(lastUserMessage);
    }
  }

  /**
   * Adds a message to the conversation
   */
  private addMessage(text: string, sender: 'user' | 'lexi', images?: string[]): void {
    this.messages = [
      ...this.messages,
      { text, sender, timestamp: new Date(), images }
    ];
    this.saveConversationHistory();
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  /**
   * Adds a message to conversation history for future AI integration
   */
  private addToConversationHistory(role: string, content: string): void {
    this.conversationHistory.push({ role, content });
    this.saveConversationHistory();
  }

  /**
   * Gets conversation history (for future AI integration)
   */
  getConversationHistory(): Array<{role: string, content: string}> {
    return this.conversationHistory;
  }

  /**
   * Sets the typing indicator state
   */
  private setTypingState(isTyping: boolean): void {
    this.ngZone.run(() => {
      this.isTyping = isTyping;
      this.cdr.detectChanges();
      if (isTyping) {
        this.scrollToBottom();
      }
    });
  }

  /**
   * Finds the index of the last user message
   */
  private findLastUserMessageIndex(): number {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].sender === 'user') {
        return i;
      }
    }
    return -1;
  }

  /**
   * Saves conversation history to localStorage (optional - disabled by default)
   */
  private saveConversationHistory(): void {
    if (!this.isBrowser) return;
    
    // Disabled by default - uncomment to enable persistence across page refreshes
    /*
    try {
      localStorage.setItem('lexi_conversation', JSON.stringify({
        messages: this.messages,
        history: this.conversationHistory
      }));
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
    */
  }

  /**
   * Clears conversation history from storage and state
   */
  clearConversationHistory(): void {
    if (!this.isBrowser) return;
    
    localStorage.removeItem('lexi_conversation');
    this.messages = [];
    this.conversationHistory = [];
    this.cdr.detectChanges();
  }

  /**
   * Scrolls chat container to bottom
   */
  private scrollToBottom(): void {
    if (!this.isBrowser) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = document.querySelector('.messages-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50); // Reduced from 150ms to 50ms for faster scroll
    });
  }
}