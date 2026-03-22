import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import ChatWidget from '@/components/ChatWidget';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  );
};

export default MainLayout;
