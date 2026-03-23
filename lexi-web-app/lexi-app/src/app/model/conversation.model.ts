export interface ConversationDto {
  id: string;
  userId: string;
  agentThreadId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessagePreview?: string;
  isActive: boolean;
}

export interface CreateConversationRequest {
  title?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  lastMessagePreview?: string;
  isActive?: boolean;
}

export interface SendMessageRequest {
  conversationId: string;
  message: string;
  images?: string[]; 
}

export interface ChatResponse {
  conversationId: string;
  userMessage: string;
  aiReply: string;
  timestamp: Date;
}

export interface AiResponseDto {
  id: string;
  conversationId: string;
  userId: string;
  userMessage: string;
  aiMessage: string;
  createdAt: Date;
  tokensUsed?: number;
}

