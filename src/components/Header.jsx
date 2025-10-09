import React from 'react';
import { MessageCircle, Shield, LogOut } from 'lucide-react';

const Header = ({ currentUser, onShowAdminDashboard, onLogout }) => {
  return (
    <div className="bg-white shadow-sm px-4 py-3 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <MessageCircle className="w-6 h-6 text-blue-500" />
        <span className="font-semibold text-gray-800">Konekt</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Welcome, {currentUser.username}</span>
        {currentUser.isAdmin && (
          <button
            onClick={onShowAdminDashboard}
            className="text-blue-500 hover:text-blue-600"
            title="Admin Dashboard"
          >
            <Shield className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onLogout}
          className="text-red-500 hover:text-red-600"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Header;
