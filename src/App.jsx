// COMPLETE FIXED App.jsx - WhatsApp-like smooth chat experience
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Clock, Users, MapPin, MessageCircle, Hash, Send, X, Check, User, Trash2, AlertTriangle } from 'lucide-react';
import LoginForm from './components/Login';  // Fixed import
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import AdminDashboard from './components/AdminDashboard';
import { threadsAPI } from './services/api';
const __DEV__ = import.meta.env.DEV;
const devError = (...args) => { if (__DEV__) console.error(...args); };
import { socket } from './socket';

// 🔧 MOVED ChatInput OUTSIDE App function to prevent re-creation
const ChatInput = ({ newMessage, setNewMessage, onSendMessage, loading, disabled }) => {
  const inputRef = useRef(null);
  const [isComposing, setIsComposing] = useState(false);

  // 🔧 KEY FEATURE: Auto-focus and maintain focus after sending
  const maintainFocus = useCallback(() => {
    if (inputRef.current && !disabled) {
      // Small delay to ensure DOM updates complete
      setTimeout(() => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }, 10);
    }
  }, [disabled]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing && !disabled) {
      e.preventDefault();
      onSendMessage();
      // 🔧 FOCUS IMMEDIATELY after sending
      maintainFocus();
    }
  }, [onSendMessage, isComposing, disabled, maintainFocus]);

  const handleSendClick = useCallback(() => {
    onSendMessage();
    // 🔧 FOCUS IMMEDIATELY after clicking send button
    maintainFocus();
  }, [onSendMessage, maintainFocus]);

  // Auto-focus when component mounts or when not disabled
  useEffect(() => {
    maintainFocus();
  }, [disabled, maintainFocus]);

  // Mobile Keyboard Persistence Fixes
  useEffect(() => {
    const handleResize = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        // Detect if mobile keyboard is open
        const keyboardOpen = viewport.height < window.innerHeight * 0.75;
        
        if (keyboardOpen) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      }
    };
  
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport.removeEventListener('resize', handleResize);
    }
  }, []);
  

  // 🔧 IMPORTANT: Refocus when loading state changes (message sent)
  useEffect(() => {
    if (!loading) {
      maintainFocus();
    }
  }, [loading, maintainFocus]);

  // 🔧 Handle blur events - refocus if user clicks elsewhere briefly
  const handleBlur = useCallback((e) => {
    // Only refocus if the blur wasn't caused by clicking the send button
    if (!e.relatedTarget || !e.relatedTarget.closest('.send-button')) {
      // Small delay to prevent interference with other interactions
      setTimeout(() => {
        if (document.activeElement !== inputRef.current && !disabled) {
          maintainFocus();
        }
      }, 100);
    }
  }, [disabled, maintainFocus]);

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          onBlur={handleBlur}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
          disabled={loading || disabled}
          maxLength={1000}
          autoComplete="off"
          spellCheck="true"
          // 🔧 Mobile optimizations
          autoCapitalize="sentences"
          autoCorrect="on"
          style={{ fontSize: '16px' }} // Prevents iOS zoom
        />
        <button
          onClick={handleSendClick}
          disabled={!newMessage.trim() || loading || disabled}
          className="send-button bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center min-w-[60px]"
          type="button"
          // 🔧 Prevent button from stealing focus
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </div>
        <div className="text-xs text-gray-500">
          {newMessage.length}/1000 characters
        </div>
      </div>
    </div>
  );
};


function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [userThreads, setUserThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(true);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my-threads');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);
  const lastMessageTimeRef = useRef(0);
  const loadingRequestRef = useRef(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);

  // Modal and notification states
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
  });

  const [notification, setNotification] = useState({
    show: false,
    type: 'success',
    message: '',
    duration: 3000
  });

  // 🔧 DEBOUNCED thread loading to prevent excessive API calls
  // const [loadingDebounce, setLoadingDebounce] = useState(null);

  //
useEffect(() => {
  if (!selectedThread?.id || !currentUser?.id) return;

  const isMember =
    selectedThread.createdBy === currentUser.id ||
    (selectedThread.members || []).some((m) => m === currentUser.id);

  if (!isMember) {
    setChatLocked(true);
    return;
  }
  setChatLocked(false);

  const currentThreadId = selectedThread.id;
  if (!socket.connected) socket.connect();
  socket.emit('joinThread', {
    threadId: currentThreadId,
    userId: currentUser.id,
  });

  const handleNewMessage = (msg) => {
    // Normalize into REST shape used by UI
    const normalized = {
      id: msg.id || `temp-${Date.now()}`,
      user: msg.username,
      userId: msg.userId,
      message: msg.message,
      timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toISOString(),
    };
    setSelectedThread((prev) => ({
      ...prev,
      chat: [...(prev.chat || []), normalized],
    }));
  };

  socket.on('newMessage', handleNewMessage);
  const handleThreadDeleted = ({ threadId, deletedBy }) => {
    if (selectedThread?.id === threadId) {
      setNotification({
        show: true,
        type: 'warning',
        message: `This thread was deleted by ${deletedBy}.`,
        duration: 3000,
      });
      setSelectedThread(null);
      setActiveTab('all-threads');
    }
  };
  socket.on('threadDeleted', handleThreadDeleted);

  return () => {
    socket.off('newMessage', handleNewMessage);
    socket.off('threadDeleted', handleThreadDeleted);
    socket.emit('leaveThread', { threadId: currentThreadId });
  };
}, [selectedThread?.id, currentUser?.id]);
useEffect(() => {
  const onUnauthorized = () => {
    setChatLocked(true);
    setSelectedThread(null);
    setNotification({ show: true, type: 'warning', message: 'Access denied. You are not a member of this thread.', duration: 2500 });
  };
  socket.on('unauthorized', onUnauthorized);
  return () => socket.off('unauthorized', onUnauthorized);
}, []);

// Identify current user for direct notifications (join requests, approvals)
// Moved below loadThreads to avoid TDZ

useEffect(() => {
  if (selectedThread?.chat?.length) {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [selectedThread?.chat?.length]);


  //

  // Persist app state and restore on refresh
  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    const savedSelectedThread = localStorage.getItem('selectedThread');
    const savedActiveTab = localStorage.getItem('activeTab');

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setCurrentUser(userData);
        setShowLoginForm(false);
      } catch (error) {
        devError('Error parsing saved user:', error);
        localStorage.removeItem('user');
      }
    }

    if (savedSelectedThread) {
      try {
        const threadData = JSON.parse(savedSelectedThread);
        setSelectedThread(threadData);
      } catch (error) {
        localStorage.removeItem('selectedThread');
      }
    }

    if (savedActiveTab) {
      setActiveTab(savedActiveTab);
    }
  }, []);

  // Auto-hide notifications
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ ...notification, show: false });
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.show, notification.duration]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedThread?.chat]);

  // 🔧 OPTIMIZED: Less frequent updates, smarter refresh logic
  useEffect(() => {
  if (currentUser && !showLoginForm) {
    loadThreads();

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTimeRef.current;

      const shouldSkipRefresh = 
        showCreateForm || 
        showEditForm || 
        showAdminDashboard ||
        sendingMessage ||
        timeSinceLastMessage < 3000;

      if (!shouldSkipRefresh) {
        loadThreads();
      }
    }, selectedThread ? 8000 : 15000);

    return () => clearInterval(interval);
  }
}, [currentUser, showLoginForm, selectedThread?.id, sendingMessage, showCreateForm, showAdminDashboard]);

     

  // Save state to localStorage
  useEffect(() => {
    if (selectedThread) {
      localStorage.setItem('selectedThread', JSON.stringify(selectedThread));
    } else {
      localStorage.removeItem('selectedThread');
    }
  }, [selectedThread]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // 🔧 OPTIMIZED: Debounced thread loading
  const loadThreads = useCallback(async () => {
  // Prevent concurrent requests
  if (loading || loadingRequestRef.current) return;

  loadingRequestRef.current = true;
  setLoading(true);
  
  try {
    const response = await threadsAPI.getAll(currentUser?.id);
    if (response.data.success) {
      const allThreads = response.data.threads.map(thread => ({
        id: thread.id,
        title: thread.title,
        description: thread.description,
        createdBy: thread.creatorId,
        createdByName: thread.creator,
        location: thread.location,
        tags: thread.tags || [],
        requiresApproval: typeof thread.requiresApproval === 'boolean' ? thread.requiresApproval : true,
        expiresAt: thread.expiresAt,
        members: thread.members || [],
        memberProfiles: thread.memberProfiles || [],
        pendingRequests: thread.pendingRequests || [],
        chat: thread.chat || [],
        createdAt: thread.createdAt,
        maxMembers: 10
      }));

      setThreads(allThreads);
      const myThreads = allThreads.filter(thread => thread.createdBy === currentUser?.id);
      setUserThreads(myThreads);

      if (selectedThread) {
        const updatedSelectedThread = allThreads.find(t => t.id === selectedThread.id);
        if (updatedSelectedThread) {
          const isMember =
            updatedSelectedThread.createdBy === currentUser?.id ||
            (updatedSelectedThread.members || []).some((m) => m === currentUser?.id);
          if (isMember) {
            setSelectedThread(updatedSelectedThread);
          } else {
            setSelectedThread(null);
            localStorage.removeItem('selectedThread');
            setNotification({
              show: true,
              type: 'warning',
              message: 'Access denied. You must be approved to open this chat.',
              duration: 2500,
            });
          }
        } else {
          setSelectedThread(null);
          localStorage.removeItem('selectedThread');
        }
      }
    }
  } catch (error) {
    devError('Error loading threads:', error);
  } finally {
    setLoading(false);
    loadingRequestRef.current = false;
  }
}, [selectedThread?.id, currentUser?.id]);

          

  const handleLogin = useCallback((user) => {
    setCurrentUser(user);
    setShowLoginForm(false);
    setActiveTab('my-threads');
    try { sessionStorage.setItem('user', JSON.stringify(user)); } catch {}
  }, []);

  const handleLogout = useCallback(() => {
    try { sessionStorage.removeItem('user'); sessionStorage.removeItem('authToken'); } catch {}
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('selectedThread');
    localStorage.removeItem('activeTab');
    setCurrentUser(null);
    setShowLoginForm(true);
    setShowAdminDashboard(false);
    setSelectedThread(null);
    setActiveTab('my-threads');
  }, []);

  const handleCreateThread = useCallback(async (threadData) => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (threadData.duration || 60) / 60);

      const response = await threadsAPI.create({
        ...threadData,
        createdBy: currentUser.id,

// Identify current user for direct notifications (join requests, approvals)
/* moved */
        createdByName: currentUser.username,
        expiresAt: expiresAt.toISOString()
      });

      if (response.data.success) {
        setShowCreateForm(false);
        setTimeout(() => {
  loadThreads();
}, 500);
        setActiveTab('my-threads');
        return { success: true };
      }
    } catch (error) {
      devError('Error creating thread:', error);
      return { success: false, error: error.message };
    }
  }, [currentUser, loadThreads]);

  const handleJoinRequest = useCallback(async (threadId, userId, approve) => {
    try {
      await threadsAPI.handleRequest(threadId, userId, approve, currentUser.id);
      await loadThreads();

      setNotification({
        show: true,
        type: 'success',
        message: `Request ${approve ? 'approved' : 'rejected'} successfully`,
        duration: 2000
      });
    } catch (error) {
      devError('Error handling join request:', error);
      setNotification({
        show: true,
        type: 'error',
        message: 'Failed to handle request',
        duration: 3000
      });
    }
  }, [currentUser, loadThreads]);

  const handleJoinThread = useCallback(async (threadId) => {
    try {
      const resp = await threadsAPI.requestJoin(threadId, currentUser.id);
      await loadThreads();

      const serverMsg = resp?.data?.message || 'Join request sent';
      setNotification({
        show: true,
        type: 'success',
        message: serverMsg === 'Joined thread' ? 'Joined thread successfully' : 'Join request sent successfully',
        duration: 2000
      });
    } catch (error) {
      devError('Error joining thread:', error);
      setNotification({
        show: true,
        type: 'error',
        message: 'Failed to send join request',
        duration: 3000
      });
    }
  }, [currentUser, loadThreads]);

  const handleDeleteThread = useCallback(async (threadId) => {
    const threadToDelete = threads.find(t => t.id === threadId) || userThreads.find(t => t.id === threadId);
    const isOwner = threadToDelete?.createdBy === currentUser.id;
    const isAdmin = currentUser?.isAdmin;

    let title = 'Delete Thread';
    let message = 'Are you sure you want to delete this thread?';
    let type = 'danger';

    if (isAdmin && !isOwner) {
      title = '⚠️ Admin Action';
      message = `You are about to delete "${threadToDelete?.title}" created by ${threadToDelete?.createdByName}.\n\nThis action cannot be undone and will remove all messages.`;
      type = 'warning';
    } else if (isOwner) {
      title = 'Delete Your Thread';
      message = `Are you sure you want to delete "${threadToDelete?.title}"?\n\nThis will permanently remove all messages and cannot be undone.`;
      type = 'danger';
    }

    setConfirmModal({
      show: true,
      title,
      message,
      type,
      onConfirm: async () => {
        try {
          setLoading(true);

          const response = await threadsAPI.delete(threadId, currentUser.id);

          if (response.data.success) {
            if (selectedThread?.id === threadId) {
              setSelectedThread(null);
              localStorage.removeItem('selectedThread');
            }

            await loadThreads();

            const deletedBy = response.data.deletedBy || (isOwner ? 'Creator' : 'Admin');
            setNotification({
              show: true,
              type: 'success',
              message: `Thread deleted successfully by ${deletedBy}`,
              duration: 3000
            });
          }
        } catch (error) {
          devError('Error deleting thread:', error);
          const errorMessage = error.response?.data?.message || 'Failed to delete thread.';
          setNotification({
            show: true,
            type: 'error',
            message: `Error: ${errorMessage}`,
            duration: 5000
          });
        } finally {
          setLoading(false);
        }
      }
    });
  }, [threads, userThreads, currentUser, selectedThread, loadThreads]);

  // Identify current user for direct notifications (join requests, approvals)
  // Global connection + realtime thread list listeners
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const onThreadCreated = (t) => {
      setThreads(prev => {
        if (prev.some(x => x.id === t.id)) return prev;
        return [...prev, {
          id: t.id,
          title: t.title,
          description: t.description,
          createdBy: t.creatorId,
          createdByName: t.creator,
          location: t.location,
          tags: t.tags || [],
          requiresApproval: typeof t.requiresApproval === 'boolean' ? t.requiresApproval : true,
          expiresAt: t.expiresAt,
          members: t.members || [],
          memberProfiles: t.memberProfiles || [{ userId: t.creatorId, username: t.creator }],
          pendingRequests: t.pendingRequests || [],
          chat: [],
          createdAt: t.createdAt,
          maxMembers: 10
        }];
      });
      setNotification({ show: true, type: 'success', message: `New thread: ${t.title}`, duration: 2000 });
    };

    const onThreadUpdated = (t) => {
      setThreads(prev => prev.map(x => x.id === t.id ? { ...x, ...t } : x));
      setUserThreads(prev => prev.map(x => x.id === t.id ? { ...x, ...t } : x));
      if (selectedThread?.id === t.id) {
        setSelectedThread(prev => ({ ...prev, ...t }));
      }
    };

    socket.on('threadCreated', onThreadCreated);
    socket.on('threadUpdated', onThreadUpdated);

    return () => {
      socket.off('threadCreated', onThreadCreated);
      socket.off('threadUpdated', onThreadUpdated);
    };
  }, [selectedThread?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (!socket.connected) socket.connect();
    socket.emit('identify', { userId: currentUser.id });

const onJoinRequest = ({ threadId, userId, username }) => {
      setThreads((prev) => prev.map(t => t.id === threadId ? {
        ...t,
        pendingRequests: [...(t.pendingRequests || []), { userId, username, requestedAt: new Date().toISOString() }]
      } : t));
      setUserThreads((prev) => prev.map(t => t.id === threadId ? {
        ...t,
        pendingRequests: [...(t.pendingRequests || []), { userId, username, requestedAt: new Date().toISOString() }]
      } : t));
      if (selectedThread?.id === threadId) {
        setSelectedThread(prev => ({
          ...prev,
          pendingRequests: [...(prev.pendingRequests || []), { userId, username, requestedAt: new Date().toISOString() }]
        }));
      }
      // Toast notify creator about new request
      setNotification({
        show: true,
        type: 'warning',
        message: `${username} requested to join your thread`,
        duration: 2500,
      });
    };

    const onRequestHandled = ({ threadId, approved }) => {
      // If this user is the requester and is viewing the thread, unlock and join immediately
      if (approved && selectedThread?.id === threadId) {
        setChatLocked(false);
        try {
          socket.connect();
          socket.emit('joinThread', { threadId, userId: currentUser.id });
        } catch {}
      }
      // Update lists without full reload
      setThreads(prev => prev.map(t => {
        if (t.id !== threadId) return t;
        const updatedMembers = Array.from(new Set([...(t.members || []), currentUser.id]));
        const updatedProfiles = Array.from(new Map([...(t.memberProfiles || []).map(p => [p.userId, p]), [currentUser.id, { userId: currentUser.id, username: currentUser.username }]])).map(([,v]) => v);
        return { ...t, members: updatedMembers, memberProfiles: updatedProfiles };
      }));
      setUserThreads(prev => prev.map(t => {
        if (t.id !== threadId) return t;
        const updatedMembers = Array.from(new Set([...(t.members || []), currentUser.id]));
        const updatedProfiles = Array.from(new Map([...(t.memberProfiles || []).map(p => [p.userId, p]), [currentUser.id, { userId: currentUser.id, username: currentUser.username }]])).map(([,v]) => v);
        return { ...t, members: updatedMembers, memberProfiles: updatedProfiles };
      }));
      setNotification({
        show: true,
        type: approved ? 'success' : 'warning',
        message: approved ? 'You have been approved to join this thread.' : 'Your join request was rejected.',
        duration: 2500,
      });
    };

    const onMembershipChanged = ({ threadId, userId, username }) => {
      setThreads(prev => prev.map(t => {
        if (t.id !== threadId) return t;
        const updatedMembers = Array.from(new Set([...(t.members || []), userId]));
        const updatedProfiles = username
          ? Array.from(new Map([...(t.memberProfiles || []).map(p => [p.userId, p]), [userId, { userId, username }]])).map(([,v]) => v)
          : (t.memberProfiles || []);
        return { ...t, members: updatedMembers, memberProfiles: updatedProfiles };
      }));
      setUserThreads(prev => prev.map(t => {
        if (t.id !== threadId) return t;
        const updatedMembers = Array.from(new Set([...(t.members || []), userId]));
        const updatedProfiles = username
          ? Array.from(new Map([...(t.memberProfiles || []).map(p => [p.userId, p]), [userId, { userId, username }]])).map(([,v]) => v)
          : (t.memberProfiles || []);
        return { ...t, members: updatedMembers, memberProfiles: updatedProfiles };
      }));
      if (selectedThread?.id === threadId) {
        setSelectedThread(prev => {
          const updatedMembers = Array.from(new Set([...(prev.members || []), userId]));
          const updatedProfiles = username
            ? Array.from(new Map([...(prev.memberProfiles || []).map(p => [p.userId, p]), [userId, { userId, username }]])).map(([,v]) => v)
            : (prev.memberProfiles || []);
          return { ...prev, members: updatedMembers, memberProfiles: updatedProfiles };
        });
      }
      // Optional toast for creator/participants
      setNotification({ show: true, type: 'success', message: `${username || 'A user'} joined the thread`, duration: 2000 });
    };

    socket.on('joinRequest', onJoinRequest);
    socket.on('requestHandled', onRequestHandled);
    socket.on('membershipChanged', onMembershipChanged);

    return () => {
      socket.off('joinRequest', onJoinRequest);
      socket.off('requestHandled', onRequestHandled);
      socket.off('membershipChanged', onMembershipChanged);
    };
  }, [currentUser?.id, loadThreads]);

  // 🔧 FIXED: WhatsApp-like smooth message sending

  const sendMessage = useCallback(() => {
  if (!newMessage.trim() || sendingMessage) return;

  const messageContent = newMessage.trim();
  const tempMessage = {
    id: 'temp-' + Date.now(),
    user: currentUser.username,
    userId: currentUser.id,
    message: messageContent,
    timestamp: new Date().toISOString(),
  };

  setNewMessage('');
  setSendingMessage(true);
  lastMessageTimeRef.current = Date.now();

  setSelectedThread(prev => ({
    ...prev,
    chat: [...(prev.chat || []), tempMessage],
  }));

  // ✅ Use socket here
  socket.emit('sendMessage', {
    threadId: selectedThread.id,
    userId: currentUser.id,
    username: currentUser.username,
    message: messageContent,
  });

  setTimeout(() => setSendingMessage(false), 300);
}, [newMessage, sendingMessage, currentUser, selectedThread]);

  
   
  

  const formatTime = useCallback((dateString) => 
    new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), []);

  const getTimeRemaining = useCallback((expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Expired';
  }, []);

  // Component definitions
  const ConfirmationModal = ({ show, onClose, onConfirm, title, message, confirmText = "Delete", cancelText = "Cancel", type = "danger" }) => {
    if (!show) return null;

    const typeStyles = {
      danger: {
        button: "bg-red-500 hover:bg-red-600 text-white",
        icon: "text-red-500",
        border: "border-red-200"
      },
      warning: {
        button: "bg-yellow-500 hover:bg-yellow-600 text-white",
        icon: "text-yellow-500", 
        border: "border-yellow-200"
      }
    };

    const currentStyle = typeStyles[type];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div className={`p-6 border-b ${currentStyle.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${currentStyle.border} border-2 flex items-center justify-center`}>
                <AlertTriangle className={`w-5 h-5 ${currentStyle.icon}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            </div>
          </div>

          <div className="p-6">
            <p className="text-gray-600 whitespace-pre-line">{message}</p>
          </div>

          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2 rounded-lg font-medium ${currentStyle.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const NotificationToast = ({ show, type, message, onClose }) => {
    if (!show) return null;

    const typeStyles = {
      success: { bg: "bg-green-500", icon: Check },
      error: { bg: "bg-red-500", icon: X },
      warning: { bg: "bg-yellow-500", icon: AlertTriangle },
      info: { bg: "bg-blue-500", icon: MessageCircle },
    };

    const style = typeStyles[type] || typeStyles.info;
    const Icon = style.icon || MessageCircle;

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className={`${style.bg} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-sm`}>
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{message}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const ThreadCard = React.memo(({ thread, showJoinButton = true, isOwner = false }) => {
    const [showRequests, setShowRequests] = useState(false);

    const canJoin = !thread.members?.includes(currentUser.id) && 
                   thread.members?.length < thread.maxMembers;
    const canDelete = isOwner || currentUser?.isAdmin;
    const hasRequests = isOwner && thread.pendingRequests?.length > 0;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-gray-900 flex-1 flex items-start flex-wrap gap-2 text-base">
            {thread.title}
            {thread.requiresApproval ? (
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wider border border-amber-200">Approval</span>
            ) : (
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold uppercase tracking-wider border border-green-200">Open</span>
            )}
          </h3>
          <div className="flex items-center gap-1">
            {canDelete && (
              <>
                {currentUser?.isAdmin && !isOwner && (
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md font-medium border border-red-200">Admin</span>
                )}
                <button
                  onClick={() => handleDeleteThread(thread.id)}
                  className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title={isOwner ? "Delete your thread" : "Delete thread (Admin)"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-2">{thread.description}</p>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg">
            <Users className="w-3.5 h-3.5 text-gray-600" />
            <span className="font-medium">{thread.members?.length || 0}/{thread.maxMembers}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-gray-600" />
            <span className="font-medium">{getTimeRemaining(thread.expiresAt)}</span>
          </div>
          {thread.location && (
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg">
              <MapPin className="w-3.5 h-3.5 text-gray-600" />
              <span className="font-medium truncate max-w-[100px]">{thread.location}</span>
            </div>
          )}
        </div>

        {hasRequests && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-blue-800">
                  {thread.pendingRequests.length} Join Request{thread.pendingRequests.length > 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => setShowRequests(!showRequests)}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-100"
              >
                {showRequests ? 'Hide' : 'Review'}
              </button>
            </div>

            {showRequests && (
              <div className="space-y-2">
                {thread.pendingRequests.map((request, index) => {
                  const username = request.username || `User_${(request.userId || request).slice(-6)}`;
                  const userId = request.userId || request;

                  return (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-800">{username}</span>
                          <div className="text-xs text-gray-500">wants to join</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleJoinRequest(thread.id, userId, false)}
                          className="px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md border border-red-200 text-xs font-medium"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleJoinRequest(thread.id, userId, true)}
                          className="px-3 py-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md border border-green-200 text-xs font-medium"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={async () => {
              const isMember =
                thread.createdBy === currentUser?.id ||
                (thread.members || []).some((m) => m === currentUser?.id);

              // If open thread (no approval) and not yet a member, auto-join then open immediately
              if (!isMember && thread.requiresApproval === false) {
                try {
                  const resp = await handleJoinThread(thread.id);
                  // Optimistically mark membership locally and unlock chat
                  const joinedThread = {
                    ...thread,
                    members: Array.from(new Set([...(thread.members || []), currentUser.id])),
                    memberProfiles: Array.from(new Map([...(thread.memberProfiles || []).map(p => [p.userId, p]), [currentUser.id, { userId: currentUser.id, username: currentUser.username }]])).map(([,v]) => v),
                  };
                  setSelectedThread(joinedThread);
                  localStorage.setItem('selectedThread', JSON.stringify(joinedThread));
                  setChatLocked(false);
                  try {
                    if (!socket.connected) socket.connect();
                    socket.emit('joinThread', { threadId: thread.id, userId: currentUser.id });
                  } catch {}
                  return;
                } catch (e) {
                  // If auto-join fails, show a brief error and avoid opening
                  setNotification({ show: true, type: 'error', message: 'Failed to join this thread.', duration: 2000 });
                  return;
                }
              }

              // For approval-required threads, block non-members and prompt to request
              const nowMember =
                thread.createdBy === currentUser?.id ||
                (thread.members || []).some((m) => m === currentUser?.id);
              if (!nowMember && thread.requiresApproval) {
                setNotification({
                  show: true,
                  type: 'warning',
                  message: 'Access denied. Request approval to open this chat.',
                  duration: 2500,
                });
                return;
              }

              setSelectedThread(thread);
              localStorage.setItem('selectedThread', JSON.stringify(thread));
            }}
            className="flex-1 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 text-gray-700 hover:text-blue-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border border-gray-200 hover:border-blue-300 group-hover:shadow-sm"
          >
            <span className="flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Open Chat {thread.chat?.length > 0 && `(${thread.chat.length})`}
            </span>
          </button>

          {showJoinButton && canJoin && !isOwner && thread.requiresApproval && (
            <button
              onClick={() => handleJoinThread(thread.id)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40"
            >
              Request Join
            </button>
          )}
        </div>
      </div>
    );
  });

  const CreateThreadForm = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tagsText, setTagsText] = useState('');
    const [location, setLocation] = useState('');
    const [duration, setDuration] = useState(60);
    const [requiresApproval, setRequiresApproval] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!title.trim() || !description.trim() || !location.trim()) {
        alert('Please fill in all required fields');
        return;
      }

      setIsSubmitting(true);
      // Parse optional tags (comma-separated)
      const tags = tagsText
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 10);

      const result = await handleCreateThread({
        title: title.trim(),
        description: description.trim(),
        tags,
        location: location.trim(),
        duration: parseInt(duration),
        requiresApproval,
      });

      if (result.success) {
        setTitle('');
        setDescription('');
        setTagsText('');
        setLocation('');
        setDuration(60);
        setRequiresApproval(true);
      }
      setIsSubmitting(false);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-slideUp">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create New Thread</h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Enter thread title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                placeholder="Describe your thread"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tags <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="music, networking, hackathon"
              />
              <p className="text-xs text-gray-500 mt-2 ml-1">Separate tags with commas</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Event location"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="15"
                max="480"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
              <div>
                <div className="text-sm font-semibold text-gray-800">Require approval to join</div>
                <div className="text-xs text-gray-500 mt-1">Members need approval before joining</div>
              </div>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 relative transition-colors shadow-inner">
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${requiresApproval ? 'translate-x-6' : ''}`}></div>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold disabled:from-blue-300 disabled:to-blue-400 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 disabled:shadow-none"
              >
                {isSubmitting ? 'Creating...' : 'Create Thread'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (showLoginForm) {
    return <LoginForm onLoginSuccess={handleLogin} />;
  }

  if (currentUser?.isAdmin && showAdminDashboard) {
    return (
      <AdminDashboard 
        currentUser={currentUser}
        onBack={() => setShowAdminDashboard(false)}
        onLogout={handleLogout}
      />
    );
  }

  // Enhanced thread chat with WhatsApp-like experience
  if (selectedThread) {
    const isCreator = selectedThread.createdBy === currentUser.id;
    const canDeleteThread = isCreator || currentUser?.isAdmin;

    return (
      <div className="flex h-screen bg-gray-50">
        <div className="w-80 bg-white shadow-sm border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-800">{selectedThread.title}</h2>
                {selectedThread.requiresApproval ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-100 text-amber-700 uppercase tracking-wide">Approval Required</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-100 text-green-700 uppercase tracking-wide">Open Join</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* {canDeleteThread && (
                  <button
                    onClick={() => handleDeleteThread(selectedThread.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                    title={isCreator ? "Delete your thread" : "Delete thread (Admin)"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )} */}
                <button
                  onClick={() => {
                    setSelectedThread(null);
                    localStorage.removeItem('selectedThread');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600">{selectedThread.description}</p>
            <div className="text-xs text-gray-500 mt-2 flex items-center gap-4">
              <span>{selectedThread.members.length} members</span>
              <span>{getTimeRemaining(selectedThread.expiresAt)} left</span>
              <span>{selectedThread.chat?.length || 0} messages</span>
            </div>
          </div>

          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-3">Members</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedThread.members.slice(0, 10).map((memberId, index) => {
                const profile = (selectedThread.memberProfiles || []).find(p => p.userId === memberId);
                const displayName = memberId === selectedThread.createdBy
                  ? `${selectedThread.createdByName} (Creator)`
                  : (profile?.username || `User ${memberId.slice(-4)}`);
                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className="text-sm text-gray-700">{displayName}</span>
                  </div>
                );
              })}
              {selectedThread.members.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  +{selectedThread.members.length - 10} more members
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-white">
            <div>
              <h2 className="font-semibold text-gray-800">{selectedThread.title}</h2>
              <div className="text-xs text-gray-500">Created by {selectedThread.createdByName}</div>
            </div>
            <div className="flex items-center gap-2">
              {selectedThread.createdBy === currentUser?.id && (selectedThread.pendingRequests?.length > 0) && (
                <button
                  onClick={() => setShowRequestsPanel(v => !v)}
                  className="relative bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-yellow-200"
                  title="Pending join requests"
                >
                  Pending requests ({selectedThread.pendingRequests.length})
                </button>
              )}
              {/* {(currentUser?.isAdmin || selectedThread.createdBy === currentUser?.id) && (
                // <button
                //   onClick={() => handleDeleteThread(selectedThread.id)}
                //   className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
                //   title="Delete thread"
                // >
                //   <Trash2 className="w-4 h-4" /> Delete
                // </button>
              )} */}
            </div>
          </div>
          {showRequestsPanel && selectedThread.createdBy === currentUser?.id && (
            <div className="px-4 py-3 bg-white border-b border-gray-200">
              <div className="text-sm font-medium text-gray-800 mb-2">Join Requests</div>
              {selectedThread.pendingRequests?.length ? (
                <div className="space-y-2">
                  {selectedThread.pendingRequests.map(req => (
                    <div key={req.userId} className="flex items-center justify-between border border-gray-200 rounded-lg p-2">
                      <div className="text-sm text-gray-700">{req.username || `User ${req.userId.slice(-4)}`}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => { await handleJoinRequest(selectedThread.id, req.userId, true); setShowRequestsPanel(false); }}
                          className="text-green-600 hover:text-green-700 text-xs flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={async () => { await handleJoinRequest(selectedThread.id, req.userId, false); setShowRequestsPanel(false); }}
                          className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No pending requests</div>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {(!chatLocked && selectedThread.chat && selectedThread.chat.length > 0) ? (
              selectedThread.chat.map((message, index) => (
                <div key={message.id || index} className={`flex ${message.userId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.userId === currentUser.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  } ${message.id?.startsWith('temp-') ? 'opacity-70' : ''}`}>
                    {message.userId !== currentUser.id && (
                      <div className="text-xs opacity-75 mb-1">{message.user}</div>
                    )}
                    <div className="text-sm">{message.message}</div>
                    <div className="text-xs opacity-75 mt-1">
                      {formatTime(message.timestamp)}
                      {message.id?.startsWith('temp-') && <span className="ml-1">⏳</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              chatLocked ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center space-y-3">
                    <MessageCircle className="w-12 h-12 mx-auto mb-1 opacity-50" />
                    <p className="font-medium">Chat is restricted</p>
                    {selectedThread?.pendingRequests?.some(p => p.userId === currentUser?.id) ? (
                      <p className="text-sm">Join request pending approval</p>
                    ) : (
                      <button
                        onClick={() => handleJoinThread(selectedThread.id)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        Request to Join
                      </button>
                    )}
                    <p className="text-xs text-gray-500">You must be approved to view and send messages.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Be the first to start the conversation!</p>
                  </div>
                </div>
              )
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 🔧 FIXED: WhatsApp-like smooth chat input */}
          <ChatInput
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onSendMessage={sendMessage}
            loading={sendingMessage}
            disabled={!selectedThread || chatLocked}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      <Header
        currentUser={currentUser}
        onShowAdminDashboard={() => setShowAdminDashboard(true)}
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userThreads={userThreads}
          threads={threads}
        />

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {activeTab === 'my-threads' && 'My Threads'}
              {activeTab === 'all-threads' && 'Discover Threads'}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {activeTab === 'my-threads' && 'Manage your created threads and conversations'}
              {activeTab === 'all-threads' && 'Join conversations and connect with others'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Create Thread
          </button>
        </div>

        {activeTab === 'my-threads' && (
          <div>
            {userThreads.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Hash className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No threads created yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">Create your first thread to start connecting with people who share your interests</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
                >
                  Create Your First Thread
                </button>
              </div>
            ) : (
              <>
                {/* Stats Dashboard */}
                <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-12">
                      <div className="text-center">
                        <div className="text-4xl font-bold mb-1">{userThreads.length}</div>
                        <div className="text-sm font-medium text-blue-100">My Threads</div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold mb-1">
                          {userThreads.reduce((total, thread) => total + (thread.members?.length || 0), 0)}
                        </div>
                        <div className="text-sm font-medium text-blue-100">Total Members</div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold mb-1">
                          {userThreads.reduce((total, thread) => total + (thread.pendingRequests?.length || 0), 0)}
                        </div>
                        <div className="text-sm font-medium text-blue-100">Pending Requests</div>
                      </div>
                    </div>

                    {userThreads.some(thread => thread.pendingRequests?.length > 0) && (
                      <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/30">
                        <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold">Review pending requests</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thread Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userThreads.map(thread => (
                    <ThreadCard 
                      key={thread.id} 
                      thread={thread} 
                      showJoinButton={false} 
                      isOwner={true}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'all-threads' && (
          <div>
            {threads.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Hash className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No active threads</h3>
                <p className="text-gray-600 max-w-md mx-auto">Be the first to create a thread and start connecting with others!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {threads.map(thread => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    showJoinButton={true}
                    isOwner={thread.createdBy === currentUser.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateForm && <CreateThreadForm />}

      {/* Confirmation Modal */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onClose={() => setConfirmModal({ ...confirmModal, show: false })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Success/Error Notifications */}
      <NotificationToast
        show={notification.show}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ ...notification, show: false })}
      />
    </div>
  );
}

export default App;
