import React, { useState } from 'react';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';

export default function App() {
  const [view, setView] = useState('login');
  const [session, setSession] = useState(null);

  if (!session) {
    return (
      <div className="min-h-screen app-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">e2eeV1</h1>
              <p className="text-sm text-gray-600">End-to-End Encrypted Messaging</p>
            </div>
            <div className="border-b border-gray-200 flex">
              <button
                onClick={() => setView('login')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  view === 'login'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setView('register')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  view === 'register'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Register
              </button>
            </div>
            <div className="px-8 pb-8">
              {view === 'login' && <Login onLoggedIn={(s) => setSession(s)} />}
              {view === 'register' && <Register onRegistered={() => setView('login')} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Chat session={session} onLogout={() => setSession(null)} />;
}
