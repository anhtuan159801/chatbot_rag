import React, { useState, useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import { MOCK_DOCUMENTS } from './services/mockData';
import { KnowledgeDocument } from '~shared/types';

// Lazy load components for performance optimization
const DashboardView = lazy(() => import('./components/DashboardView'));
const KnowledgeBaseView = lazy(() => import('./components/KnowledgeBaseView'));
const ChatHistoryView = lazy(() => import('./components/ChatHistoryView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const MemberDirectoryView = lazy(() => import('./components/MemberDirectoryView'));

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const savedTab = localStorage.getItem('activeTab');
      return savedTab || 'dashboard';
    } catch (e) {
      console.error('Error loading activeTab from localStorage:', e);
      return 'dashboard';
    }
  });

  // State quản lý tài liệu với localStorage persistence
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(() => {
    try {
      const savedDocuments = localStorage.getItem('documents');
      return savedDocuments ? JSON.parse(savedDocuments) : MOCK_DOCUMENTS;
    } catch (e) {
      console.error('Error loading documents from localStorage:', e);
      return MOCK_DOCUMENTS;
    }
  });

  // State quản lý cấu hình Facebook (để chia sẻ giữa Settings và ChatHistory) với localStorage persistence
  const [fbConfig, setFbConfig] = useState(() => {
    try {
      const savedConfig = localStorage.getItem('fbConfig');
      return savedConfig ? JSON.parse(savedConfig) : {
        pageName: '',
        pageId: '',
        accessToken: ''
      };
    } catch (e) {
      console.error('Error loading fbConfig from localStorage:', e);
      return {
        pageName: '',
        pageId: '',
        accessToken: ''
      };
    }
  });

  // Update localStorage when documents change
  useEffect(() => {
    localStorage.setItem('documents', JSON.stringify(documents));
  }, [documents]);

  // Update localStorage when fbConfig changes
  useEffect(() => {
    localStorage.setItem('fbConfig', JSON.stringify(fbConfig));
  }, [fbConfig]);

  // Update localStorage when activeTab changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-slate-500">Đang tải bảng điều khiển...</p>
              </div>
            </div>
          }>
            <DashboardView documents={documents} />
          </Suspense>
        );
      case 'knowledge':
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-slate-500">Đang tải kho dữ liệu...</p>
              </div>
            </div>
          }>
            <KnowledgeBaseView documents={documents} setDocuments={setDocuments} />
          </Suspense>
        );
      case 'chat':
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-slate-500">Đang tải lịch sử trò chuyện...</p>
              </div>
            </div>
          }>
            <ChatHistoryView fbConfig={fbConfig} />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-slate-500">Đang tải cài đặt...</p>
              </div>
            </div>
          }>
            <SettingsView fbConfig={fbConfig} setFbConfig={setFbConfig} />
          </Suspense>
        );
      case 'members':
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-slate-500">Đang tải danh bạ...</p>
              </div>
            </div>
          }>
            <MemberDirectoryView />
          </Suspense>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Đang xây dựng</h3>
                <p>Module {activeTab} đang được hoàn thiện.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <ToastProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </ToastProvider>
  );
};

export default App;