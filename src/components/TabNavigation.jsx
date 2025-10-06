import React from 'react';

const TabNavigation = ({ activeTab, onTabChange, userThreads, threads }) => {
  // Calculate total pending requests across all user threads
  const totalRequests = userThreads.reduce((total, thread) => 
    total + (thread.pendingRequests?.length || 0), 0
  );

  const tabs = [
    {
      id: 'my-threads',
      label: `My Threads (${userThreads.length})`,
      hasNotification: totalRequests > 0,
      notificationCount: totalRequests
    },
    {
      id: 'all-threads', 
      label: `All Threads (${threads.length})`,
      hasNotification: false,
      notificationCount: 0
    }
  ];

  return (
    <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {tab.label}
          {tab.hasNotification && tab.notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {tab.notificationCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;
