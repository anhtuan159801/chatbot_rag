import React, { useState } from 'react';
import Layout from './components/Layout';
import DashboardView from './components/DashboardView';
import KnowledgeBaseView from './components/KnowledgeBaseView';
import ChatHistoryView from './components/ChatHistoryView';
import SettingsView from './components/SettingsView';
import { ToastProvider } from './components/Toast';
import { MOCK_DOCUMENTS } from './services/mockData';
import { KnowledgeDocument } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State quản lý tài liệu
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(MOCK_DOCUMENTS);

  // State quản lý cấu hình Facebook (để chia sẻ giữa Settings và ChatHistory)
  const [fbConfig, setFbConfig] = useState({ 
    pageName: '', 
    pageId: '', 
    accessToken: '' 
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView documents={documents} />;
      case 'knowledge':
        return <KnowledgeBaseView documents={documents} setDocuments={setDocuments} />;
      case 'chat':
        return <ChatHistoryView fbConfig={fbConfig} />;
      case 'settings':
        return <SettingsView fbConfig={fbConfig} setFbConfig={setFbConfig} />;
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