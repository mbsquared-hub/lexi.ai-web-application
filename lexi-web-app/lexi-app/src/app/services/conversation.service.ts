import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ConversationDto,
  CreateConversationRequest,
  UpdateConversationRequest,
  SendMessageRequest,
  ChatResponse,
  AiResponseDto
} from '../model/conversation.model';

@Injectable({
  providedIn: 'root'
})
export class ConversationService {

  constructor(private api: ApiService) {}

  // ─── GET /api/conversations ───────────────────────────────────────────────
  getConversations(): Observable<ConversationDto[]> {
    return this.api.get<ConversationDto[]>('api/conversations');
  }

  // ─── POST /api/conversations ──────────────────────────────────────────────
  createConversation(request: CreateConversationRequest = {}): Observable<ConversationDto> {
    return this.api.post<ConversationDto>('api/conversations', request);
  }

  // ─── GET /api/conversations/{conversationId} ──────────────────────────────
  getConversation(conversationId: string): Observable<ConversationDto> {
    return this.api.get<ConversationDto>(`api/conversations/${conversationId}`);
  }

  // ─── PATCH /api/conversations/{conversationId} ────────────────────────────
  updateConversation(conversationId: string, request: UpdateConversationRequest): Observable<ConversationDto> {
    return this.api.patch<ConversationDto>(`api/conversations/${conversationId}`, request);
  }

  // ─── DELETE /api/conversations/{conversationId} ───────────────────────────
  deleteConversation(conversationId: string): Observable<void> {
    return this.api.delete<void>(`api/conversations/${conversationId}`);
  }

  // ─── POST /api/chat/send ──────────────────────────────────────────────────
  sendMessage(conversationId: string, message: string, images?: string[]): Observable<ChatResponse> {
    const request: SendMessageRequest = {
      conversationId,
      message,
      images: images && images.length > 0 ? images : undefined
    };
    return this.api.post<ChatResponse>('api/chat/send', request);
  }

  // ─── GET /api/chat/history/{conversationId} ───────────────────────────────
  getChatHistory(conversationId: string): Observable<AiResponseDto[]> {
    return this.api.get<AiResponseDto[]>(`api/chat/history/${conversationId}`);
  }
}