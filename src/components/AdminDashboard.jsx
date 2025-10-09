import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  LogOut, 
  Users, 
  MessageCircle, 
  Activity, 
  Trash2,
  Search,
  Eye,
  Clock,
  MapPin,
  Hash
} from 'lucide-react';
import { adminAPI, threadsAPI } from '../services/api';

const AdminDashboard = ({ currentUser, onBack, onLogout }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDashboard(currentUser.id);
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteThread = async (threadId) => {
    if (window.confirm('Are you sure you want to delete this thread?')) {
      try {
        await threadsAPI.delete(threadId, currentUser.id);
        await loadDashboardData();
        alert('Thread deleted successfully');
      } catch (error) {
        console.error('Error deleting thread:', error);
        alert('Failed to delete thread');
      }
    }
  };

  const formatTime = (dateString) => 
    new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getTimeRemaining = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Expired';
  };

  const filteredThreads = dashboardData?.threads?.filter(thread =>
    thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.creator.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-800 mb-1">{value}</h3>
      <p className="text-gray-600 text-sm">{title}</p>
    </div>
  );

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, {currentUser.username}</span>
          <button
            onClick={onBack}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            Back to Threads
          </button>
          <button
            onClick={onLogout}
            className="text-red-500 hover:text-red-600 p-1"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={MessageCircle}
            title="Total Threads"
            value={dashboardData?.totalThreads || 0}
            color="bg-blue-500"
          />
          <StatCard
            icon={Users}
            title="Total Users"
            value={dashboardData?.totalUsers || 0}
            color="bg-green-500"
          />
          <StatCard
            icon={Activity}
            title="Active Users"
            value={dashboardData?.activeUsers || 0}
            color="bg-purple-500"
          />
        </div>

        {/* Threads Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">All Threads</h2>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="p-6">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-8">
                <Hash className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No threads found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredThreads.map(thread => {
                  const isExpired = new Date(thread.expiresAt) <= new Date();
                  
                  return (
                    <div key={thread.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">{thread.title}</h3>
                          <p className="text-gray-600 text-sm mb-2">{thread.description}</p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Creator: {thread.creator}</span>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span>{thread.members.length} members</span>
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
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isExpired 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {isExpired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          Messages: {thread.chat.length} • 
                          Created: {formatTime(thread.createdAt)}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteThread(thread.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded"
                            title="Delete thread"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
