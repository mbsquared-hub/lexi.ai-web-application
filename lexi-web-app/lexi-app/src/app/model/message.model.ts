export interface Message {
  id: string;
  role: 'user' | 'lexi';
  content: string;
  timestamp?: Date;
  images?: string[];
}