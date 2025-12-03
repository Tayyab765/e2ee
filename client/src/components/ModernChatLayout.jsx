import React, { useState } from 'react';
import ContactList from './ContactList';
import ChatWindow from './ChatWindow';
import Avatar from './Avatar';

export default function ModernChatLayout({
  contacts = [],
  messages = [],
  meId,
  typing = false,
  onSelectContact,
  activeContactId,
  onSendMessage,
}) {
  const [input, setInput] = useState('');
  const activeContact = contacts.find(c => c.id === activeContactId);

  return (
    <div className="app-gradient min-h-full text-gray-900">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-6 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3" style={{ height: 'calc(100vh - 280px)', minHeight: '500px', maxHeight: '700px' }}>
          <aside className="hidden lg:flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="px-4 py-3 text-base font-semibold text-gray-900 border-b border-gray-200 bg-gray-50">Messages</div>
            <ContactList contacts={contacts} activeId={activeContactId} onSelect={onSelectContact} />
          </aside>
          <section className="bg-white rounded-xl shadow-lg flex flex-col border border-gray-200 h-full max-h-full overflow-hidden">
            {activeContact ? (
              <div className="flex items-center space-x-3 px-3 sm:px-5 py-3 border-b border-gray-200 bg-gray-50">
                <Avatar name={activeContact.name} online={activeContact.online} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-gray-900 truncate">{activeContact.name}</div>
                  <div className="text-xs text-gray-600">Last seen 3 hours ago</div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 text-gray-600">
                  <button className="hover:text-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </button>
                  <button className="hover:text-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button className="hover:text-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-200 bg-gray-50">
                <div className="text-sm font-medium text-gray-700">Select a conversation to start messaging</div>
              </div>
            )}
            <div className="flex-1 overflow-hidden min-h-0">
              <ChatWindow messages={messages} meId={meId} typing={typing} />
            </div>
            <div className="px-3 sm:px-4 py-3 border-t border-gray-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) {
                    onSendMessage?.(input.trim());
                    setInput('');
                  }
                }}
                className="flex items-center gap-2"
              >
                <button type="button" className="text-gray-500 hover:text-purple-600 p-1.5 transition-colors hidden sm:block">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <input
                  className="flex-1 bg-gray-50 rounded-full px-4 sm:px-5 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-200"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button type="button" className="text-gray-500 hover:text-purple-600 p-1.5 transition-colors hidden sm:block">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button type="button" className="text-gray-500 hover:text-purple-600 p-1.5 transition-colors hidden md:block">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-full shadow-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
