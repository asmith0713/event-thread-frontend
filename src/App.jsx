// COMPLETE FIXED App.jsx - WhatsApp-like smooth chat experience
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Clock, Users, MapPin, MessageCircle, Hash, Send, X, Check, User, Trash2, AlertTriangle } from 'lucide-react';
import LoginForm from './components/Login';  // Fixed import
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import AdminDashboard from './components/AdminDashboard';
import { threadsAPI } from './services/api';  // Fixed import

// 🔧 MOVED ChatInput OUTSIDE App function to prevent re-creation
const ChatInput = ({ newMessage, setNewMessage, onSendMessage, loading, disabled }) => {
  const inputRef = useRef(null);
  const [isComposing, setIsComposing] = useState(false);

  // 🔧 KEY FEATURE: Auto-focus and maintain focus after sending
  const maintainFocus = useCallback(() => {
    if (inputRef.current && !disabled) {
      // Small delay to ensure DOM updates complete
      setTimeout(() => {
        inputRef.current.focus();
        // Set cursor at end of input (if there's any text)
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
  const [activeTab, setActiveTab] = useState('my-threads');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);
  const lastMessageTimeRef = useRef(0);

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
  const [loadingDebounce, setLoadingDebounce] = useState(null);

  // Persist app state and restore on refresh
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedSelectedThread = localStorage.getItem('selectedThread');
    const savedActiveTab = localStorage.getItem('activeTab');

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setCurrentUser(userData);
        setShowLoginForm(false);
      } catch (error) {
        console.error('Error parsing saved user:', error);
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

      // Only refresh when not actively typing
      const interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastMessage = now - lastMessageTimeRef.current;

        // Don't refresh if user sent a message in the last 3 seconds
        if (timeSinceLastMessage > 3000 && !sendingMessage) {
          loadThreads();
        }
      }, selectedThread ? 8000 : 15000); // 8s in chat, 15s on main page

      return () => clearInterval(interval);
    }
  }, [currentUser, showLoginForm, selectedThread?.id, sendingMessage]);

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
    if (loading) return;

    // Clear existing debounce
    if (loadingDebounce) {
      clearTimeout(loadingDebounce);
    }

    // Set new debounce
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await threadsAPI.getAll();
        if (response.data.success) {
          const allThreads = response.data.threads.map(thread => ({
            id: thread.id,
            title: thread.title,
            description: thread.description,
            createdBy: thread.creatorId,
            createdByName: thread.creator,
            location: thread.location,
            tags: thread.tags || [],
            expiresAt: thread.expiresAt,
            members: thread.members || [],
            pendingRequests: thread.pendingRequests || [],
            chat: thread.chat || [],
            createdAt: thread.createdAt,
            maxMembers: 10
          }));

          setThreads(allThreads);
          const myThreads = allThreads.filter(thread => thread.createdBy === currentUser?.id);
          setUserThreads(myThreads);

          // Update selected thread if it exists
          if (selectedThread) {
            const updatedSelectedThread = allThreads.find(t => t.id === selectedThread.id);
            if (updatedSelectedThread) {
              setSelectedThread(updatedSelectedThread);
            } else {
              setSelectedThread(null);
              localStorage.removeItem('selectedThread');
            }
          }
        }
      } catch (error) {
        console.error('Error loading threads:', error);
      } finally {
        setLoading(false);
      }
    }, 100); // 100ms debounce

    setLoadingDebounce(timeoutId);
  }, [loading, selectedThread, currentUser]);

  const handleLogin = useCallback((user) => {
    setCurrentUser(user);
    setShowLoginForm(false);
    setActiveTab('my-threads');
    localStorage.setItem('user', JSON.stringify(user));
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
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
        createdByName: currentUser.username,
        expiresAt: expiresAt.toISOString()
      });

      if (response.data.success) {
        setShowCreateForm(false);
        await loadThreads();
        setActiveTab('my-threads');
        return { success: true };
      }
    } catch (error) {
      console.error('Error creating thread:', error);
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
      console.error('Error handling join request:', error);
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
      await threadsAPI.requestJoin(threadId, currentUser.id);
      await loadThreads();

      setNotification({
        show: true,
        type: 'success',
        message: 'Join request sent successfully',
        duration: 2000
      });
    } catch (error) {
      console.error('Error joining thread:', error);
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
          console.error('Error deleting thread:', error);
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

  // 🔧 FIXED: WhatsApp-like smooth message sending
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || sendingMessage) return;
  
    const messageContent = newMessage.trim();
    const tempMessage = {
      id: 'temp-' + Date.now(),
      user: currentUser.username,
      userId: currentUser.id,
      message: messageContent,
      timestamp: new Date().toISOString()
    };
  
    // 🔧 Clear input IMMEDIATELY but don't change focus
    setNewMessage('');
    setSendingMessage(true);
    lastMessageTimeRef.current = Date.now();
  
    // Add optimistic message
    setSelectedThread(prev => ({
      ...prev,
      chat: [...(prev.chat || []), tempMessage]
    }));
  
    try {
      const response = await threadsAPI.sendMessage(selectedThread.id, {
        userId: currentUser.id,
        username: currentUser.username,
        content: messageContent
      });
  
      if (response.data.success) {
        // Update thread data after successful send
        setTimeout(async () => {
          const updatedResponse = await threadsAPI.getAll();
          if (updatedResponse.data.success) {
            const updatedThread = updatedResponse.data.threads.find(t => t.id === selectedThread.id);
            if (updatedThread) {
              const mappedThread = {
                id: updatedThread.id,
                title: updatedThread.title,
                description: updatedThread.description,
                createdBy: updatedThread.creatorId,
                createdByName: updatedThread.creator,
                location: updatedThread.location,
                tags: updatedThread.tags || [],
                expiresAt: updatedThread.expiresAt,
                members: updatedThread.members || [],
                pendingRequests: updatedThread.pendingRequests || [],
                chat: updatedThread.chat || [],
                createdAt: updatedThread.createdAt,
                maxMembers: 10
              };
              setSelectedThread(mappedThread);
              localStorage.setItem('selectedThread', JSON.stringify(mappedThread));
            }
          }
          setSendingMessage(false);
        }, 300);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      setSelectedThread(prev => ({
        ...prev,
        chat: prev.chat.filter(msg => msg.id !== tempMessage.id)
      }));
      
      setNewMessage(messageContent);
      setSendingMessage(false);
      
      setNotification({
        show: true,
        type: 'error',
        message: 'Failed to send message. Please try again.',
        duration: 3000
      });
    }
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
      error: { bg: "bg-red-500", icon: X }
    };

    const style = typeStyles[type];
    const Icon = style.icon;

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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-800 flex-1">{thread.title}</h3>
          <div className="flex items-center gap-1">
            {canDelete && (
              <>
                {currentUser?.isAdmin && !isOwner && (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Admin</span>
                )}
                <button
                  onClick={() => handleDeleteThread(thread.id)}
                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                  title={isOwner ? "Delete your thread" : "Delete thread (Admin)"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-3">{thread.description}</p>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{thread.members?.length || 0}/{thread.maxMembers}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{getTimeRemaining(thread.expiresAt)}</span>
          </div>
          {thread.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{thread.location}</span>
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

        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedThread(thread);
              localStorage.setItem('selectedThread', JSON.stringify(thread));
            }}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium"
          >
            View Chat {thread.chat?.length > 0 && `(${thread.chat.length})`}
          </button>

          {showJoinButton && canJoin && !isOwner && (
            <button
              onClick={() => handleJoinThread(thread.id)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium"
            >
              Join
            </button>
          )}
        </div>
      </div>
    );
  });

  const CreateThreadForm = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [duration, setDuration] = useState(60);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!title.trim() || !description.trim() || !location.trim()) {
        alert('Please fill in all required fields');
        return;
      }

      setIsSubmitting(true);
      const result = await handleCreateThread({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        duration: parseInt(duration)
      });

      if (result.success) {
        setTitle('');
        setDescription('');
        setLocation('');
        setDuration(60);
      }
      setIsSubmitting(false);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Create New Thread</h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Event title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your event"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Event location"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="15"
                max="480"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
              >
                {isSubmitting ? 'Creating...' : 'Create'}
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
              <h2 className="font-semibold text-gray-800">{selectedThread.title}</h2>
              <div className="flex items-center gap-2">
                {canDeleteThread && (
                  <button
                    onClick={() => handleDeleteThread(selectedThread.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                    title={isCreator ? "Delete your thread" : "Delete thread (Admin)"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
              {selectedThread.members.slice(0, 10).map((memberId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-500" />
                  </div>
                  <span className="text-sm text-gray-700">
                    {memberId === selectedThread.createdBy 
                      ? `${selectedThread.createdByName} (Creator)` 
                      : `User ${memberId.slice(-4)}`
                    }
                  </span>
                </div>
              ))}
              {selectedThread.members.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  +{selectedThread.members.length - 10} more members
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedThread.chat && selectedThread.chat.length > 0 ? (
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
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Be the first to start the conversation!</p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 🔧 FIXED: WhatsApp-like smooth chat input */}
          <ChatInput
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onSendMessage={sendMessage}
            loading={sendingMessage}
            disabled={!selectedThread}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        currentUser={currentUser}
        onShowAdminDashboard={() => setShowAdminDashboard(true)}
        onLogout={handleLogout}
      />

      <div className="max-w-6xl mx-auto p-6">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userThreads={userThreads}
          threads={threads}
        />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {activeTab === 'my-threads' && 'My Threads'}
            {activeTab === 'all-threads' && 'All Active Threads'}
          </h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Thread
          </button>
        </div>

        {activeTab === 'my-threads' && (
          <div>
            {userThreads.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Hash className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No threads created yet</h3>
                <p className="text-gray-600 mb-4">Create your first thread to connect with others!</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
                >
                  Create Thread
                </button>
              </div>
            ) : (
              <>
                {/* Stats Dashboard */}
                <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{userThreads.length}</div>
                        <div className="text-sm text-blue-800 font-medium">My Threads</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {userThreads.reduce((total, thread) => total + (thread.members?.length || 0), 0)}
                        </div>
                        <div className="text-sm text-green-800 font-medium">Total Members</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600">
                          {userThreads.reduce((total, thread) => total + (thread.pendingRequests?.length || 0), 0)}
                        </div>
                        <div className="text-sm text-yellow-800 font-medium">Pending Requests</div>
                      </div>
                    </div>

                    {userThreads.some(thread => thread.pendingRequests?.length > 0) && (
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">You have join requests to review!</span>
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
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Hash className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No active threads</h3>
                <p className="text-gray-600">Be the first to create an event thread!</p>
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