import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import Scene from './components/Scene';
import { User, ChatMessage, RoomInfo } from './types';
import { SOCKET_URL, AI_HOST_ID, AI_HOST_NAME, LANGUAGES, TOPICS } from './constants';
import { audioManager } from './services/audio';
import { generateHostResponse } from './services/geminiService';

// Styles for custom scrollbar
const scrollbarStyles = `
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #64748b; }
  .animate-fade-in { animation: fadeIn 0.5s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

type ViewState = 'LOBBY' | 'CREATE_ROOM' | 'ROOM';

const App: React.FC = () => {
  // App State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [view, setView] = useState<ViewState>('LOBBY');
  
  // Data State
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  
  // Forms
  const [username, setUsername] = useState('');
  const [createForm, setCreateForm] = useState({ title: '', language: 'English', topic: 'Casual Chat' });
  const [inputMessage, setInputMessage] = useState('');
  
  // Audio
  const [micEnabled, setMicEnabled] = useState(false);
  const [voiceLevels, setVoiceLevels] = useState<Record<string, number>>({});
  const rafRef = useRef<number>();

  // Initialize Socket
  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected');
      s.emit('get-rooms');
    });

    s.on('room-list', (list: RoomInfo[]) => setRooms(list));

    s.on('room-created', (roomId: string) => {
      s.emit('join-room', { roomId, username });
    });

    s.on('room-state', ({ info, users }: { info: RoomInfo, users: User[] }) => {
      setCurrentRoom(info);
      setUsers(users);
      setView('ROOM');
      setMessages([]);
      setLastMessages({});
    });

    s.on('user-joined', (user: User) => {
      setUsers(prev => [...prev, user]);
      addSystemMessage(`${user.username} joined.`);
    });

    s.on('user-left', (userId: string) => {
      setUsers(prev => {
        const u = prev.find(x => x.id === userId);
        if (u) addSystemMessage(`${u.username} left.`);
        return prev.filter(u => u.id !== userId);
      });
    });

    s.on('user-updated', (updatedUser: User) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      if (updatedUser.isSpeaker && !users.find(u => u.id === updatedUser.id)?.isSpeaker) {
        addSystemMessage(`${updatedUser.username} stepped up to the stage.`);
      }
    });

    s.on('room-info-update', (info: RoomInfo) => {
      setCurrentRoom(info);
    });

    s.on('new-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      setLastMessages(prev => ({ ...prev, [msg.userId]: msg.text }));
    });

    s.on('user-voice-activity', ({ userId, volume }: { userId: string, volume: number }) => {
      setVoiceLevels(prev => ({ ...prev, [userId]: volume }));
    });

    // Refresh room list periodically if in lobby
    const interval = setInterval(() => {
      if (view === 'LOBBY') s.emit('get-rooms');
    }, 5000);

    return () => {
      clearInterval(interval);
      s.disconnect();
    };
  }, [username, view]);

  // Audio Loop
  const startAudioLoop = () => {
    const loop = () => {
      if (audioManager) {
        const vol = audioManager.getVolume();
        if (socket && socket.connected && currentRoom) {
           socket.emit('voice-activity', { roomId: currentRoom.id, volume: vol });
           setVoiceLevels(prev => ({ ...prev, [socket.id || '']: vol }));
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  useEffect(() => {
    if (micEnabled) {
      audioManager.initialize().then(() => startAudioLoop()).catch(console.error);
    } else {
      audioManager.cleanup();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [micEnabled]);

  // Actions
  const handleJoinRoom = (roomId: string) => {
    if (!username) {
      alert('Please enter a username first');
      return;
    }
    socket?.emit('join-room', { roomId, username });
  };

  const handleCreateRoom = () => {
    if (!username) {
      alert('Please enter a username first');
      return;
    }
    socket?.emit('create-room', { ...createForm, username });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !socket || !currentRoom) return;

    const msg = inputMessage;
    socket.emit('send-message', { roomId: currentRoom.id, message: msg });
    setInputMessage('');

    // AI Logic
    if (msg.toLowerCase().includes('@ai') || msg.toLowerCase().includes('@host') || (Math.random() > 0.8 && users.length < 3)) {
      const context = {
        users: users.map(u => u.username),
        topic: currentRoom.topic,
        language: currentRoom.language
      };
      const response = await generateHostResponse(msg, context);
      
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          userId: AI_HOST_ID, 
          text: response, 
          timestamp: Date.now() 
        }]);
        setLastMessages(prev => ({ ...prev, [AI_HOST_ID]: response }));
      }, 1500);
    }
  };

  const toggleHand = () => {
    if (!currentRoom || !socket) return;
    socket.emit('raise-hand', { roomId: currentRoom.id });
  };

  const promoteUser = (userId: string) => {
    if (!currentRoom || !socket) return;
    socket.emit('promote-user', { roomId: currentRoom.id, userId });
  };

  const demoteUser = (userId: string) => {
    if (!currentRoom || !socket) return;
    socket.emit('move-to-audience', { roomId: currentRoom.id, userId });
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, { userId: 'system', text, timestamp: Date.now() }]);
  };

  // Keep currentUser updated
  useEffect(() => {
    if (socket && users.length > 0) {
      const me = users.find(u => u.id === socket.id);
      if (me) setCurrentUser(me);
    }
  }, [users, socket]);

  const allUsers = [
    ...users, 
    { 
      id: AI_HOST_ID, 
      username: AI_HOST_NAME, 
      isSpeaker: true, 
      isHost: false,
      handRaised: false,
      position: { x: 0, y: 0, z: -2.5 }, 
      color: '#ec4899', 
      micActive: true 
    }
  ];

  // --- Render Views ---

  if (view === 'LOBBY') {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
        <style>{scrollbarStyles}</style>
        
        <header className="w-full max-w-4xl flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">VoxStage 3D</h1>
            <p className="text-slate-400 text-sm">Immersive Language Exchange</p>
          </div>
          <div className="flex gap-4 items-center">
            <input 
              type="text" 
              placeholder="Enter Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={() => {
                 if(!username) return alert('Enter username');
                 setView('CREATE_ROOM');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold text-sm transition-all"
            >
              + Create Room
            </button>
          </div>
        </header>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.length === 0 ? (
            <div className="col-span-2 text-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
              No active rooms. Be the first to create one!
            </div>
          ) : (
            rooms.map(room => (
              <div key={room.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-indigo-500 transition-all group cursor-pointer" onClick={() => handleJoinRoom(room.id)}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded uppercase tracking-wider">{room.language}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    👥 {room.userCount}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-1 group-hover:text-indigo-300 transition-colors">{room.title}</h3>
                <p className="text-slate-400 text-sm mb-4">{room.topic}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                   <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Now
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'CREATE_ROOM') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
          <h2 className="text-2xl font-bold mb-6">Create Voice Room</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Room Title</label>
              <input 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                value={createForm.title}
                onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                placeholder="e.g. English Practice for Beginners"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Target Language</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                value={createForm.language}
                onChange={(e) => setCreateForm({...createForm, language: e.target.value})}
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.flag} {l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Topic</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                value={createForm.topic}
                onChange={(e) => setCreateForm({...createForm, topic: e.target.value})}
              >
                 {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setView('LOBBY')} className="flex-1 py-2 text-slate-400 hover:text-white font-medium">Cancel</button>
              <button 
                onClick={handleCreateRoom}
                disabled={!createForm.title}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold disabled:opacity-50"
              >
                Start Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      <style>{scrollbarStyles}</style>

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Scene 
          users={allUsers} 
          currentUser={currentUser} 
          lastMessages={lastMessages}
          voiceLevels={voiceLevels}
        />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
        
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg min-w-[200px]">
            <h2 className="text-white font-bold text-lg leading-none mb-1">{currentRoom?.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="bg-indigo-900/60 px-1.5 py-0.5 rounded text-indigo-200">{currentRoom?.language}</span>
              <span>• {currentRoom?.topic}</span>
            </div>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-500/80 hover:bg-red-600 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg"
          >
            Leave
          </button>
        </div>

        {/* Host Controls Overlay (If Host) */}
        {currentUser?.isHost && (
           <div className="absolute top-24 left-6 pointer-events-auto bg-slate-900/90 backdrop-blur p-4 rounded-xl border border-white/10 w-64 shadow-xl max-h-[40vh] overflow-y-auto">
             <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Host Controls</h3>
             
             {users.filter(u => u.handRaised).length > 0 && (
               <div className="mb-4">
                 <h4 className="text-sm font-bold text-white mb-2">✋ Raised Hands</h4>
                 <div className="space-y-2">
                   {users.filter(u => u.handRaised).map(u => (
                     <div key={u.id} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                       <span className="text-sm text-white truncate">{u.username}</span>
                       <button onClick={() => promoteUser(u.id)} className="bg-green-600 text-xs px-2 py-1 rounded text-white font-bold">Accept</button>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             <div>
               <h4 className="text-sm font-bold text-white mb-2">🎤 Speakers</h4>
               <div className="space-y-2">
                 {users.filter(u => u.isSpeaker && !u.isHost).map(u => (
                    <div key={u.id} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                       <span className="text-sm text-white truncate">{u.username}</span>
                       <button onClick={() => demoteUser(u.id)} className="bg-red-900/50 hover:bg-red-900 text-xs px-2 py-1 rounded text-red-200">Audience</button>
                    </div>
                 ))}
                 {users.filter(u => u.isSpeaker && !u.isHost).length === 0 && <p className="text-xs text-slate-500 italic">No other speakers</p>}
               </div>
             </div>
           </div>
        )}

        {/* Bottom Area: Controls & Chat */}
        <div className="flex flex-col md:flex-row gap-4 items-end pointer-events-auto max-h-[50vh]">
          
          {/* Chat Box */}
          <div className="w-full md:w-96 bg-slate-900/90 backdrop-blur-md rounded-xl border border-white/10 flex flex-col shadow-2xl overflow-hidden h-64 md:h-80 transition-all">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => {
                const isSystem = msg.userId === 'system';
                const isHost = msg.userId === AI_HOST_ID;
                return (
                  <div key={idx} className={`text-sm ${isSystem ? 'text-yellow-500 italic text-center text-xs my-2' : 'text-slate-200'}`}>
                    {!isSystem && (
                      <span className={`font-bold mr-2 ${isHost ? 'text-pink-400' : 'text-indigo-400'}`}>
                        {msg.userId === currentUser?.id ? 'You' : 
                         msg.userId === AI_HOST_ID ? AI_HOST_NAME : 
                         users.find(u => u.id === msg.userId)?.username || 'Unknown'}:
                      </span>
                    )}
                    {msg.text}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="p-2 border-t border-white/10 bg-slate-800/50">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Chat..."
                  className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-bold">Send</button>
              </div>
            </form>
          </div>

          {/* User Controls */}
          <div className="flex flex-col gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-lg">
            {currentUser?.isSpeaker ? (
              <button 
                onClick={() => setMicEnabled(!micEnabled)}
                className={`p-3 rounded-lg transition-colors w-14 h-14 flex items-center justify-center ${micEnabled ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-700 text-slate-400'}`}
                title="Toggle Mic"
              >
                 <span className="text-2xl">{micEnabled ? '🎙️' : '🔇'}</span>
              </button>
            ) : (
              <button 
                onClick={toggleHand}
                className={`p-3 rounded-lg transition-colors w-14 h-14 flex items-center justify-center ${currentUser?.handRaised ? 'bg-yellow-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                title="Raise Hand to Speak"
              >
                 <span className="text-2xl">✋</span>
              </button>
            )}
            
            {/* Info Status for User */}
            {!currentUser?.isSpeaker && (
               <div className="text-[10px] text-center text-slate-400 font-medium max-w-[56px] leading-tight">
                 {currentUser?.handRaised ? 'Waiting...' : 'Listen Only'}
               </div>
            )}
            {currentUser?.isSpeaker && (
               <div className="text-[10px] text-center text-green-400 font-medium max-w-[56px] leading-tight">
                 On Stage
               </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;
