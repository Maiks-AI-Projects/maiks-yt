"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, ShieldAlert, UserX, Send, Youtube, Twitch } from 'lucide-react';
import { sendChatMessage } from '@/app/dashboard/chatActions';

interface ChatMessage {
  id: string;
  platform: 'youtube' | 'twitch';
  author: string;
  message: string;
  avatar?: string;
  timestamp: string;
}

export default function UnifiedChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to SSE for real-time chat
    const eventSource = new EventSource('/api/events?channel=global');

    eventSource.onmessage = (event) => {
      try {
        const appEvent = JSON.parse(event.data);
        if (appEvent.type === 'chat') {
          setMessages((prev) => [...prev, {
            id: appEvent.id,
            platform: appEvent.data.platform || 'youtube',
            author: appEvent.data.author || 'User',
            message: appEvent.data.message || '',
            avatar: appEvent.data.avatar,
            timestamp: appEvent.timestamp
          }].slice(-50)); // Keep last 50
        }
      } catch (e) {
        // Heartbeats are also received as messages but might fail JSON.parse if they aren't formatted as such
        // but our heartbeat is just ": heartbeat\n\n" which shouldn't trigger onmessage usually
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleModeration = (action: string, id: string) => {
    console.log(`Moderation: ${action} on ${id}`);
    if (action === 'delete') {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleSendMessage = async () => {
    if (inputValue.trim()) {
      try {
        const res = await sendChatMessage(inputValue);
        if (res.success) {
          setInputValue('');
        } else {
          alert(`Message blocked by AI: ${res.reason}`);
        }
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-black border-4 border-white rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      <div className="bg-white text-black p-6 flex justify-between items-center">
        <h2 className="text-4xl font-black uppercase tracking-tighter italic">Live Chat</h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-red-600 text-white px-4 py-1 rounded-full font-black animate-pulse">
            <span className="w-3 h-3 bg-white rounded-full" />
            LIVE
          </div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {messages.length === 0 && (
          <div className="text-zinc-800 text-center py-32 font-black text-4xl uppercase opacity-20 select-none">
            No Messages Yet
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="group flex items-start gap-6 p-6 bg-zinc-900/50 border-4 border-zinc-800 rounded-[2rem] hover:border-white transition-all transform hover:scale-[1.01]">
            <div className="relative">
              {msg.avatar ? (
                <img src={msg.avatar} alt={msg.author} className="w-16 h-16 rounded-2xl border-4 border-white object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-zinc-700 flex items-center justify-center font-black text-3xl border-4 border-white">
                  {msg.author[0]}
                </div>
              )}
              <div className={`absolute -bottom-2 -right-2 p-1 rounded-lg border-2 border-black ${msg.platform === 'twitch' ? 'bg-[#9146FF]' : 'bg-[#FF0000]'}`}>
                {msg.platform === 'twitch' ? <Twitch size={16} color="white" /> : <Youtube size={16} color="white" />}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-black text-yellow-400 tracking-tighter uppercase truncate">{msg.author}</span>
                <span className="text-sm text-zinc-600 font-mono font-bold">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-3xl font-bold text-white leading-tight break-words">{msg.message}</p>
            </div>

            <div className="hidden group-hover:flex flex-col gap-3">
              <button 
                onClick={() => handleModeration('delete', msg.id)}
                className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-lg"
                title="Delete Message"
              >
                <Trash2 size={24} />
              </button>
              <button 
                onClick={() => handleModeration('timeout', msg.id)}
                className="p-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl transition-all shadow-lg"
                title="Timeout User"
              >
                <ShieldAlert size={24} />
              </button>
              <button 
                onClick={() => handleModeration('ban', msg.id)}
                className="p-3 bg-zinc-800 hover:bg-black text-white rounded-xl transition-all shadow-lg"
                title="Ban User"
              >
                <UserX size={24} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-zinc-900 border-t-8 border-white flex gap-4">
        <input 
          type="text" 
          placeholder="COMMUNICATE..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 bg-black text-white text-2xl font-black p-6 border-4 border-white rounded-2xl focus:outline-none focus:ring-4 focus:ring-yellow-400 placeholder:text-zinc-800 uppercase tracking-widest"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
        />
        <button 
          onClick={handleSendMessage}
          className="bg-white text-black px-10 py-6 font-black text-2xl uppercase rounded-2xl hover:bg-yellow-400 transition-all flex items-center gap-3 active:scale-95 shadow-[0_10px_0_rgb(150,150,150)] hover:shadow-[0_10px_0_rgb(202,138,4)]"
        >
          <Send size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
