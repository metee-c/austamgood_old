'use client';

import React, { useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Minimize2,
  Maximize2,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAIChat } from '@/contexts/AIChatContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface GlobalAIChatProps {
  // Future: API endpoint configuration
  apiEndpoint?: string;
}

export const GlobalAIChat: React.FC<GlobalAIChatProps> = ({ apiEndpoint }) => {
  const { isOpen, closeChat } = useAIChat();
  
  // UI State
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'สวัสดีครับ ผมคือผู้ช่วย AI สำหรับระบบ WMS คุณสามารถถามคำถามเกี่ยวกับคลังสินค้า สต็อก หรือการดำเนินงานได้เลยครับ',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleToggleChat = () => {
    closeChat();
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleClearChat = () => {
    if (confirm('คุณต้องการล้างประวัติการสนทนาทั้งหมดหรือไม่?')) {
      setMessages([
        {
          id: 'welcome-' + Date.now(),
          role: 'system',
          content: 'ประวัติการสนทนาถูกล้างแล้ว พร้อมเริ่มต้นการสนทนาใหม่',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Call AI Chat API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          conversation_history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'API request failed');
      }

      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Chat error:', error);
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: error instanceof Error 
          ? `เกิดข้อผิดพลาด: ${error.message}` 
          : 'เกิดข้อผิดพลาดในการส่งข้อความ กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-thai-gray-200 transition-all duration-300 ${
            isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
          } flex flex-col overflow-hidden`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm font-thai">AI ผู้ช่วยคลังสินค้า</h3>
                <p className="text-xs opacity-90">AustamGood WMS Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleMinimize}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                aria-label={isMinimized ? 'ขยาย' : 'ย่อ'}
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleToggleChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-thai-gray-25 to-white">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-primary-500 text-white rounded-2xl rounded-tr-sm'
                          : message.role === 'system'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200 rounded-xl'
                          : message.error
                          ? 'bg-red-50 text-red-800 border border-red-200 rounded-2xl rounded-tl-sm'
                          : 'bg-white text-thai-gray-800 border border-thai-gray-200 rounded-2xl rounded-tl-sm'
                      } px-4 py-3 shadow-sm`}
                    >
                      {message.error && (
                        <div className="flex items-center gap-2 mb-2 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-semibold">ข้อผิดพลาด</span>
                        </div>
                      )}
                      <p className="text-sm font-thai whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === 'user'
                            ? 'text-white/70'
                            : 'text-thai-gray-500'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-thai-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-thai-gray-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-thai">กำลังพิมพ์...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-thai-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={handleClearChat}
                    className="text-xs text-thai-gray-500 hover:text-red-600 transition-colors flex items-center gap-1 font-thai"
                    title="ล้างประวัติการสนทนา"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ล้างประวัติ
                  </button>
                </div>

                <div className="flex items-end gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="พิมพ์คำถามของคุณ..."
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 border border-thai-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-thai placeholder:text-thai-gray-400 disabled:bg-thai-gray-50 disabled:cursor-not-allowed"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="px-4 py-3"
                    icon={isLoading ? Loader2 : Send}
                    aria-label="ส่งข้อความ"
                  >
                    {isLoading ? '' : ''}
                  </Button>
                </div>

                <p className="text-xs text-thai-gray-400 mt-2 text-center font-thai">
                  AI อาจให้ข้อมูลที่ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลก่อนใช้งาน
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default GlobalAIChat;
