import { Component, PLATFORM_ID, Inject, ChangeDetectorRef, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Message {
  text: string;
  sender: 'user' | 'lexi';
  timestamp: Date;
  images?: string[];
  isVoice?: boolean;
  isEditing?: boolean;
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
  canStopGeneration = false; // Track if we can stop the current generation
  private isBrowser: boolean;
  private pasteListener?: (event: ClipboardEvent) => void;
  
  // Image preview/staging
  stagedImages: string[] = [];
  showImagePreview = false;
  readonly MAX_IMAGES = 5;

  // Image viewer
  viewingImage: string | null = null;

  // Edit prompt
  editingMessageIndex: number | null = null;
  editedText: string = '';

  // Voice recording properties
  isRecording = false;
  isListening = false;
  voiceTranscript = '';
  private recognition: any;
  recordingDuration = 0;
  private recordingTimer: any;
  private networkErrorCount = 0;
  private totalErrorCount = 0;
  hasVoiceTranscript = false;

  // Conversation history
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
      localStorage.removeItem('lexi_conversation');
      this.setupPasteListener();
      this.initializeSpeechRecognition();
    }
  }

  onImageError(event: any): void {
    console.error('Image failed to load:', event.target.src);
    console.log('Trying alternative path...');
    // Try alternative paths
    if (event.target.src.includes('assets/logo-dashboard.svg')) {
      event.target.src = '/assets/logo-dashboard.svg';
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.pasteListener) {
        document.removeEventListener('paste', this.pasteListener);
      }
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
      }
    }
  }

  /**
   * Initialize Web Speech API
   */
  private initializeSpeechRecognition(): void {
    if (!this.isBrowser) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          let interimTranscript = '';
          let finalTranscript = this.voiceTranscript;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          this.voiceTranscript = finalTranscript.trim();
          
          if (interimTranscript) {
            this.userInput = (this.voiceTranscript + ' ' + interimTranscript).trim();
          } else {
            this.userInput = this.voiceTranscript;
          }

          this.cdr.detectChanges();
        });
      };

      this.recognition.onerror = (event: any) => {
        console.warn('⚠️ Speech recognition error:', event.error);
        this.ngZone.run(() => {
          if (event.error === 'network') {
            this.networkErrorCount++;
            this.totalErrorCount++;
            console.log(`⚠️ Network error count: ${this.networkErrorCount}, Total errors: ${this.totalErrorCount}`);
            
            if (this.networkErrorCount >= 2 || this.totalErrorCount >= 5) {
              console.error('❌ Too many errors, stopping recognition');
              alert('Voice recognition is not working properly in Edge. Please use Chrome or Safari for voice input, or type your message instead.');
              this.resetRecordingState();
              this.networkErrorCount = 0;
              this.totalErrorCount = 0;
            }
            return;
          }
          
          this.totalErrorCount++;
          
          if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
          }
          
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            alert('Microphone access was denied. Please enable microphone permissions.');
            this.resetRecordingState();
            return;
          }
          
          console.warn('Continuing despite error:', event.error);
        });
      };

      this.recognition.onstart = () => {
        this.ngZone.run(() => {
          console.log('✅ Recognition actually started (onstart fired)');
          this.isListening = true;
          this.cdr.detectChanges();
        });
      };

      this.recognition.onend = () => {
        this.ngZone.run(() => {
          console.log('🔚 Recognition ended (onend fired)');
          this.isListening = false;
          
          if (this.isRecording && this.totalErrorCount < 5) {
            console.log('🔄 Attempting to restart recognition...');
            try {
              setTimeout(() => {
                if (this.isRecording && this.recognition) {
                  this.recognition.start();
                }
              }, 100);
            } catch (e) {
              console.error('Failed to restart:', e);
              this.resetRecordingState();
            }
          } else if (this.totalErrorCount >= 5) {
            console.error('❌ Too many errors, not restarting');
            this.resetRecordingState();
          }
          
          this.cdr.detectChanges();
        });
      };
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
    }
  }

  /**
   * Toggle voice recording
   */
  toggleVoiceRecording(): void {
    console.log('🎤 Mic button clicked! isRecording:', this.isRecording);
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  /**
   * Start voice recording
   */
  private async startRecording(): Promise<void> {
    console.log('▶️ Starting recording...');
    
    if (!this.isBrowser) {
      alert('Voice recording is not available.');
      return;
    }

    if (!this.recognition) {
      alert('Voice recording is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      console.log('🎤 Checking microphone permissions...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted');
        stream.getTracks().forEach(track => track.stop());
      } catch (permissionError) {
        console.error('❌ Microphone permission denied:', permissionError);
        alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
        return;
      }

      this.voiceTranscript = '';
      this.userInput = '';
      this.recordingDuration = 0;
      this.networkErrorCount = 0;
      this.totalErrorCount = 0;
      
      console.log('🎙️ Starting speech recognition...');
      
      let recognitionStarted = false;
      
      const safetyTimeout = setTimeout(() => {
        if (!recognitionStarted && this.isRecording) {
          console.error('⚠️ Recognition failed to start within 3 seconds, resetting...');
          alert('Speech recognition failed to start. This can happen in Edge. Please try again or use Chrome/Safari.');
          this.resetRecordingState();
        }
      }, 3000);
      
      try {
        this.recognition.start();
        console.log('✅ Speech recognition start() called');
      } catch (startError: any) {
        clearTimeout(safetyTimeout);
        console.error('❌ Recognition start error:', startError);
        
        if (startError.message && startError.message.includes('already started')) {
          console.log('⚠️ Recognition already started, restarting...');
          this.recognition.stop();
          setTimeout(() => {
            try {
              this.recognition.start();
              console.log('✅ Speech recognition restarted');
            } catch (e) {
              console.error('❌ Failed to restart:', e);
              alert('Failed to start voice recording. Please try again.');
              this.resetRecordingState();
              return;
            }
          }, 100);
        } else {
          throw startError;
        }
      }
      
      this.isRecording = true;
      this.isListening = true;
      
      setTimeout(() => {
        recognitionStarted = this.isListening;
        clearTimeout(safetyTimeout);
      }, 100);
      
      console.log('⏱️ Starting timer');
      
      this.recordingTimer = setInterval(() => {
        this.ngZone.run(() => {
          this.recordingDuration++;
          console.log('⏱️ Recording duration:', this.recordingDuration);
          
          if (this.recordingDuration >= 120) {
            console.log('⏰ Max duration reached, stopping...');
            this.stopRecording();
          }
          
          this.cdr.detectChanges();
        });
      }, 1000);

      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      alert('Failed to start recording. Please check your microphone and try again.');
      this.resetRecordingState();
    }
  }

  /**
   * Stop voice recording
   */
  private stopRecording(): void {
    console.log('⏹️ Stopping recording...');
    
    if (!this.isRecording) {
      console.log('⚠️ Not recording, skipping stop');
      return;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
        console.log('✅ Speech recognition stopped');
      } catch (e) {
        console.error('❌ Error stopping recognition:', e);
      }
    }

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
      console.log('✅ Timer cleared');
    }

    this.isRecording = false;
    this.isListening = false;
    this.recordingDuration = 0;
    
    if (this.userInput.trim()) {
      this.hasVoiceTranscript = true;
      console.log('✅ Voice transcript saved, hiding mic button');
    }
    
    console.log('✅ Recording stopped. Transcript:', this.userInput);
    
    this.cdr.detectChanges();
  }

  /**
   * Cancel voice recording
   */
  cancelVoiceRecording(): void {
    console.log('❌ Cancelling recording...');
    this.resetRecordingState();
    this.userInput = '';
    this.hasVoiceTranscript = false;
  }

  /**
   * Reset recording state (for error recovery)
   */
  private resetRecordingState(): void {
    console.log('🔄 Resetting recording state...');
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors
      }
    }

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    this.isRecording = false;
    this.isListening = false;
    this.voiceTranscript = '';
    this.recordingDuration = 0;
    this.networkErrorCount = 0;
    this.totalErrorCount = 0;
    this.hasVoiceTranscript = false;
    
    this.cdr.detectChanges();
  }

  /**
   * Format recording duration
   */
  get formattedDuration(): string {
    const minutes = Math.floor(this.recordingDuration / 60);
    const seconds = this.recordingDuration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get hasImages(): boolean {
    return this.showImagePreview && this.stagedImages.length > 0;
  }

  get isUploadDisabled(): boolean {
    return this.stagedImages.length >= this.MAX_IMAGES || this.isRecording;
  }

  get inputPlaceholder(): string {
    if (this.isRecording) {
      return 'Listening...';
    }
    if (this.showImagePreview && this.stagedImages.length > 0) {
      return 'Ask a question (optional)...';
    }
    return 'Ask Lexi about anything....';
  }

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

  private addImageToStaging(blob: Blob): void {
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
        setTimeout(() => {
          const input = document.querySelector('.chat-input') as HTMLInputElement;
          if (input) input.focus();
        }, 100);
      });
    };
    reader.readAsDataURL(blob);
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    if (this.stagedImages.length + files.length > this.MAX_IMAGES) {
      alert(`You can only upload up to ${this.MAX_IMAGES} images at a time.`);
      event.target.value = '';
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        alert(`File "${file.name}" is not an image.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`Image "${file.name}" must be less than 10MB.`);
        continue;
      }
      this.addImageToStaging(file);
    }
    event.target.value = '';
  }

  removeImage(index: number): void {
    this.stagedImages.splice(index, 1);
    if (this.stagedImages.length === 0) {
      this.showImagePreview = false;
    }
    this.cdr.detectChanges();
  }

  cancelAllImages(): void {
    this.stagedImages = [];
    this.showImagePreview = false;
    this.cdr.detectChanges();
  }

  /**
   * Open image viewer
   */
  openImageViewer(image: string): void {
    this.viewingImage = image;
    this.cdr.detectChanges();
  }

  /**
   * Close image viewer
   */
  closeImageViewer(): void {
    this.viewingImage = null;
    this.cdr.detectChanges();
  }

  /**
   * Start editing a message
   */
  startEditingMessage(index: number): void {
    if (this.messages[index].sender !== 'user') return;
    
    this.editingMessageIndex = index;
    this.editedText = this.messages[index].text;
    this.cdr.detectChanges();
  }

  /**
   * Cancel editing
   */
  cancelEdit(): void {
    this.editingMessageIndex = null;
    this.editedText = '';
    this.cdr.detectChanges();
  }

  /**
   * Save edited message
   */
  saveEdit(): void {
    if (this.editingMessageIndex === null) return;
    
    const trimmedText = this.editedText.trim();
    if (!trimmedText) {
      alert('Message cannot be empty');
      return;
    }

    // Update the message
    this.messages[this.editingMessageIndex].text = trimmedText;
    
    // Remove all messages after this one
    this.messages = this.messages.slice(0, this.editingMessageIndex + 1);
    
    // Update conversation history
    this.conversationHistory = this.conversationHistory.slice(0, (this.editingMessageIndex + 1) * 2);
    this.conversationHistory[this.editingMessageIndex * 2].content = trimmedText;
    
    // Clear editing state
    this.editingMessageIndex = null;
    this.editedText = '';
    
    // Send the edited message with stop button enabled
    this.setTypingState(true);
    this.canStopGeneration = true; // Enable stop button
    this.simulateAIResponse(trimmedText);
  }

  /**
   * Stop generation
   */
  stopGeneration(): void {
    if (!this.canStopGeneration) return;
    
    this.canStopGeneration = false;
    this.setTypingState(false);
    
    // Add a message indicating generation was stopped
    this.addMessage('[Generation stopped by user]', 'lexi');
    this.addToConversationHistory('assistant', '[Generation stopped by user]');
  }

  formatMessage(text: string): SafeHtml {
    if (!text) return '';
    let formatted = this.applyInlineFormatting(text);
    const htmlLines = this.parseLines(formatted.split('\n'));
    return this.sanitizer.bypassSecurityTrustHtml(htmlLines.join(''));
  }

  private applyInlineFormatting(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

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

      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        inUnorderedList = this.closeUnorderedList(result, inUnorderedList);
        inOrderedList = this.openOrderedList(result, inOrderedList);
        result.push(`<li>${numberedMatch[2]}`);
        continue;
      }

      const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
      if (bulletMatch) {
        inUnorderedList = this.openUnorderedList(result, inUnorderedList);
        result.push(`<li>${bulletMatch[1]}</li>`);
        continue;
      }

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

    if (inUnorderedList) result.push('</ul>', '</li>');
    if (inOrderedList) result.push('</ol>');
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

  sendMessage(): void {
    const trimmedInput = this.userInput.trim();
    
    // If only images, no text required
    if (this.stagedImages.length > 0) {
      this.sendImagesWithMessage();
      return;
    }

    if (!trimmedInput) return;

    const isVoiceMessage = this.voiceTranscript.length > 0;
    this.addMessage(trimmedInput, 'user', undefined, isVoiceMessage);
    this.addToConversationHistory('user', isVoiceMessage ? `[Voice] ${trimmedInput}` : trimmedInput);
    
    this.userInput = '';
    this.voiceTranscript = '';
    this.hasVoiceTranscript = false;
    
    console.log('✅ Message sent, mic button will show again');
    
    this.setTypingState(true);
    this.canStopGeneration = true; // Enable stop button
    this.simulateAIResponse(trimmedInput);
  }

  private sendImagesWithMessage(): void {
    if (this.stagedImages.length === 0) return;

    const images = [...this.stagedImages];
    const prompt = this.userInput.trim(); // Allow empty text with images
    
    // Only add message text if there is actual text
    this.addMessage(prompt, 'user', images);
    
    // Update conversation history
    if (prompt) {
      this.addToConversationHistory('user', `[${images.length} image(s)] ${prompt}`);
    } else {
      this.addToConversationHistory('user', `[${images.length} image(s)]`);
    }
    
    this.userInput = '';
    this.stagedImages = [];
    this.showImagePreview = false;
    this.setTypingState(true);
    this.canStopGeneration = true; // Enable stop button
    this.simulateImageAnalysisResponse(prompt, images.length);
  }

  private simulateAIResponse(userMessage: string): void {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!this.canStopGeneration) return; // Check if stopped
        
        const response = "Hi! Thanks for your message. I'm currently not connected to Azure OpenAI yet.";
        this.ngZone.run(() => {
          this.canStopGeneration = false;
          this.setTypingState(false);
          this.addMessage(response, 'lexi');
          this.addToConversationHistory('assistant', response);
        });
      }, 1000); // Simulate some delay
    });
  }

  private simulateImageAnalysisResponse(prompt: string, imageCount: number): void {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!this.canStopGeneration) return; // Check if stopped
        
        const imageText = imageCount === 1 ? 'image' : `${imageCount} images`;
        const response = prompt 
          ? `Hi! Thanks for your message. I'm currently not connected to Azure OpenAI yet hence I'll review the ${imageText} later once connected.`
          : `I see you've shared ${imageText}. I'm currently not connected to Azure OpenAI yet hence I'll review them later once connected.`;
        
        this.ngZone.run(() => {
          this.canStopGeneration = false;
          this.setTypingState(false);
          this.addMessage(response, 'lexi');
          this.addToConversationHistory('assistant', response);
        });
      }, 1000); // Simulate some delay
    });
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!this.isRecording) {
        this.sendMessage();
      }
    }
  }

  selectSuggestion(suggestion: string): void {
    this.userInput = suggestion;
    this.sendMessage();
  }

  regenerateResponse(): void {
    if (this.messages.length === 0 || this.isTyping) return;

    const lastUserMessageIndex = this.findLastUserMessageIndex();
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = this.messages[lastUserMessageIndex].text;
    const lastUserImages = this.messages[lastUserMessageIndex].images;

    this.messages = this.messages.slice(0, lastUserMessageIndex + 1);
    this.conversationHistory = this.conversationHistory.slice(0, (lastUserMessageIndex + 1) * 2);
    this.setTypingState(true);
    this.canStopGeneration = true; // Enable stop button

    if (lastUserImages && lastUserImages.length > 0) {
      this.simulateImageAnalysisResponse(lastUserMessage, lastUserImages.length);
    } else {
      this.simulateAIResponse(lastUserMessage);
    }
  }

  private addMessage(text: string, sender: 'user' | 'lexi', images?: string[], isVoice?: boolean): void {
    this.messages = [...this.messages, { text, sender, timestamp: new Date(), images, isVoice }];
    this.saveConversationHistory();
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private addToConversationHistory(role: string, content: string): void {
    this.conversationHistory.push({ role, content });
    this.saveConversationHistory();
  }

  getConversationHistory(): Array<{role: string, content: string}> {
    return this.conversationHistory;
  }

  private setTypingState(isTyping: boolean): void {
    this.ngZone.run(() => {
      this.isTyping = isTyping;
      if (!isTyping) {
        this.canStopGeneration = false;
      }
      this.cdr.detectChanges();
      if (isTyping) this.scrollToBottom();
    });
  }

  private findLastUserMessageIndex(): number {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].sender === 'user') return i;
    }
    return -1;
  }

  private saveConversationHistory(): void {
    // Disabled by default
  }

  clearConversationHistory(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem('lexi_conversation');
    this.messages = [];
    this.conversationHistory = [];
    this.cdr.detectChanges();
  }

  private scrollToBottom(): void {
    if (!this.isBrowser) return;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = document.querySelector('.messages-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
    });
  }
}