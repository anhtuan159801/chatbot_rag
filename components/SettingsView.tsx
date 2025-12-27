import React, { useState, useEffect } from 'react';
import {
    Facebook, Save, Copy, CheckCircle, RefreshCw,
    Shield, ExternalLink, Link, Check, Cpu, Layers, MessageSquare,
    Play, Send, Bot, User, Image as ImageIcon, Headphones, Database, Activity,
    ArrowLeft, Settings as SettingsIcon, Zap, Server, Eye, EyeOff
} from 'lucide-react';
import { useToast } from './Toast';

type TabType = 'integrations' | 'models' | 'roles' | 'test';

interface ModelConfig {
    id: string;
    provider: 'gemini' | 'openai' | 'openrouter' | 'huggingface';
    name: string;
    modelString: string;
    apiKey: string; // Still needed for the UI but won't be saved
    isActive: boolean;
}

interface SettingsViewProps {
    fbConfig: { pageName: string; pageId: string; accessToken: string };
    setFbConfig: React.Dispatch<React.SetStateAction<{ pageName: string; pageId: string; accessToken: string }>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ fbConfig, setFbConfig }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('integrations');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // --- Facebook Integration State ---
  // Sử dụng props fbConfig thay vì state local
  const isFbConnected = !!(fbConfig.pageId && fbConfig.accessToken);
  const [isConnectingFb, setIsConnectingFb] = useState(false);
  const [showFbToken, setShowFbToken] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // --- AI Models State ---
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [savingModels, setSavingModels] = useState(false);

  // Load initial models from the server when component mounts
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('/api/models');
        if (response.ok) {
          const serverModels = await response.json();
          setModels(serverModels);
        } else {
          // Fallback to default models if API call fails
          setModels([
            { id: 'gemini-1', provider: 'gemini', name: 'Google Gemini', modelString: 'gemini-3-flash-preview', apiKey: 'Configured via environment variable', isActive: true },
            { id: 'openai-1', provider: 'openai', name: 'OpenAI', modelString: 'gpt-4o', apiKey: 'Configured via environment variable', isActive: false },
            { id: 'openrouter-1', provider: 'openrouter', name: 'OpenRouter', modelString: 'openai/whisper-large-v3', apiKey: 'Configured via environment variable', isActive: false },
            { id: 'hf-1', provider: 'huggingface', name: 'Hugging Face', modelString: 'xiaomi/mimo-v2-flash:free', apiKey: 'Configured via environment variable', isActive: false },
          ]);
        }
      } catch (error) {
        console.error('Error loading models:', error);
        // Fallback to default models if API call fails
        setModels([
          { id: 'gemini-1', provider: 'gemini', name: 'Google Gemini', modelString: 'gemini-3-flash-preview', apiKey: 'Configured via environment variable', isActive: true },
          { id: 'openai-1', provider: 'openai', name: 'OpenAI', modelString: 'gpt-4o', apiKey: 'Configured via environment variable', isActive: false },
          { id: 'openrouter-1', provider: 'openrouter', name: 'OpenRouter', modelString: 'openai/whisper-large-v3', apiKey: 'Configured via environment variable', isActive: false },
          { id: 'hf-1', provider: 'huggingface', name: 'Hugging Face', modelString: 'xiaomi/mimo-v2-flash:free', apiKey: 'Configured via environment variable', isActive: false },
        ]);
      }
    };

    loadModels();
  }, []);

  // --- AI Roles State ---
  const [roles, setRoles] = useState({
    chatbotText: 'gemini-1',
    chatbotVision: 'gemini-1',
    chatbotAudio: 'gemini-1',
    rag: 'openai-1',
    analysis: 'gemini-1',
    sentiment: 'hf-1',
    systemPrompt: 'Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.'
  });

  // Load initial roles from the server when component mounts
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch('/api/roles');
        if (response.ok) {
          const serverRoles = await response.json();
          setRoles(serverRoles);
        } else {
          // Fallback to default roles if API call fails
          setRoles({
            chatbotText: 'gemini-1',
            chatbotVision: 'gemini-1',
            chatbotAudio: 'gemini-1',
            rag: 'openai-1',
            analysis: 'gemini-1',
            sentiment: 'hf-1',
            systemPrompt: 'Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.'
          });
        }
      } catch (error) {
        console.error('Error loading roles:', error);
        // Fallback to default roles if API call fails
        setRoles({
          chatbotText: 'gemini-1',
          chatbotVision: 'gemini-1',
          chatbotAudio: 'gemini-1',
          rag: 'openai-1',
          analysis: 'gemini-1',
          sentiment: 'hf-1',
          systemPrompt: 'Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.'
        });
      }
    };

    loadRoles();
  }, []);

  // --- Chat Test State ---
  const [testMessages, setTestMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: 'Hệ thống Sẵn sàng. Bạn có thể kiểm tra kịch bản tư vấn thủ tục hành chính tại đây.' }
  ]);
  const [testInput, setTestInput] = useState('');
  const [isTestSending, setIsTestSending] = useState(false);

  // --- Handlers ---
  const handleFbConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingFb(true);

    try {
      // Save the Facebook configuration to the server
      const response = await fetch('/api/facebook-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: fbConfig.pageId,
          accessToken: fbConfig.accessToken,
          pageName: fbConfig.pageName || 'Cổng Dịch Vụ Công Trực Tuyến'
        })
      });

      const result = await response.json();

      if (result.success) {
        if (!fbConfig.pageName) setFbConfig(prev => ({ ...prev, pageName: 'Cổng Dịch Vụ Công Trực Tuyến' }));
        showToast('Kết nối Fanpage thành công! Dữ liệu chat sẽ được đồng bộ.', 'success');
        setLastSaved(new Date());
      } else {
        showToast('Lưu cấu hình Facebook thất bại.', 'error');
      }
    } catch (error) {
      console.error('Error saving Facebook config:', error);
      showToast('Lỗi kết nối máy chủ khi lưu cấu hình.', 'error');
    } finally {
      setIsConnectingFb(false);
    }
  };

  const handleFbDisconnect = async () => {
    if (confirm('Ngắt kết nối Fanpage? Dữ liệu lịch sử chat sẽ bị ẩn.')) {
      try {
        // Clear the Facebook configuration from the server
        const response = await fetch('/api/facebook-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: '',
            accessToken: '',
            pageName: ''
          })
        });

        const result = await response.json();

        if (result.success) {
          setFbConfig({ pageName: '', pageId: '', accessToken: '' });
          showToast('Đã ngắt kết nối.', 'info');
        } else {
          showToast('Lỗi khi ngắt kết nối từ máy chủ.', 'error');
        }
      } catch (error) {
        console.error('Error disconnecting Facebook config:', error);
        showToast('Lỗi kết nối máy chủ khi ngắt kết nối.', 'error');
      }
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    showToast('Đã sao chép vào bộ nhớ tạm', 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const updateModelField = (id: string, field: keyof ModelConfig, value: string) => {
    // Don't update the API key field since it's handled by environment variables
    if (field === 'apiKey') {
      return;
    }
    setModels(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const toggleModelActive = (id: string) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m));
  };

  const saveModels = async () => {
    setSavingModels(true);

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(models)
      });

      const result = await response.json();

      if (result.success) {
        showToast('Đã lưu cấu hình AI.', 'success');
        setLastSaved(new Date());
      } else {
        showToast('Lưu cấu hình AI thất bại.', 'error');
      }
    } catch (error) {
      console.error('Error saving models:', error);
      showToast('Lỗi kết nối máy chủ khi lưu cấu hình AI.', 'error');
    } finally {
      setSavingModels(false);
    }
  };

  const handleTestSend = () => {
    if (!testInput.trim()) return;
    const userMsg = testInput;
    setTestMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setTestInput('');
    setIsTestSending(true);

    setTimeout(() => {
        const activeModelName = models.find(m => m.id === roles.chatbotText)?.name || 'Unknown Model';
        
        // Simulating a proper administrative response
        const simulatedResponse = `[Phản hồi từ ${activeModelName}]\n` +
            `Xin chào công dân. Tôi đã nhận được câu hỏi: "${userMsg}".\n\n` +
            `Dựa trên cơ sở dữ liệu quốc gia về thủ tục hành chính, tôi xin phản hồi như sau:\n` +
            `1. Về thành phần hồ sơ: Cần chuẩn bị CCCD, Mẫu đơn XX-2024.\n` +
            `2. Thời gian giải quyết: 05 ngày làm việc.\n` +
            `\nLưu ý: Công dân có thể nộp hồ sơ trực tuyến để được giảm 50% lệ phí.`;

        setTestMessages(prev => [...prev, { 
            role: 'bot', 
            text: simulatedResponse
        }]);
        setIsTestSending(false);
    }, 1500);
  };

  // --- Render Sections ---
  const renderIntegrations = () => (
    <div className="space-y-6">
       {/* Facebook Card */}
       <div className={`rounded-2xl border transition-all duration-300 shadow-sm ${isFbConnected ? 'bg-white border-blue-200 shadow-blue-500/5' : 'bg-white border-slate-200'}`}>
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${isFbConnected ? 'bg-blue-600 shadow-blue-600/30' : 'bg-slate-100'}`}>
              <Facebook size={28} className={isFbConnected ? 'text-white' : 'text-slate-400'} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Kênh Facebook Messenger
                {isFbConnected && <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200 flex items-center gap-1"><CheckCircle size={12} /> Hoạt động</span>}
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                {isFbConnected 
                  ? `Đang kết nối trang: ${fbConfig.pageName}` 
                  : 'Kết nối Fanpage để tự động trả lời công dân và đồng bộ tin nhắn.'}
              </p>
            </div>
          </div>
          {isFbConnected && (
            <button onClick={handleFbDisconnect} className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium w-full md:w-auto">
              Ngắt kết nối
            </button>
          )}
        </div>
        <div className="p-6">
          {!isFbConnected ? (
            <form onSubmit={handleFbConnect} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="fb-page-id" className="text-sm font-semibold text-slate-700">Page ID</label>
                  <input 
                    id="fb-page-id"
                    type="text" 
                    value={fbConfig.pageId} 
                    onChange={(e) => setFbConfig({...fbConfig, pageId: e.target.value})} 
                    placeholder="VD: 1029384756" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all focus:bg-white" 
                    required 
                    aria-describedby="fb-page-id-help"
                  />
                  <p id="fb-page-id-help" className="text-xs text-slate-500">Nhập ID của trang Facebook bạn muốn kết nối</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="fb-page-name" className="text-sm font-semibold text-slate-700">Tên Trang (Tùy chọn)</label>
                  <input 
                    id="fb-page-name"
                    type="text" 
                    value={fbConfig.pageName} 
                    onChange={(e) => setFbConfig({...fbConfig, pageName: e.target.value})} 
                    placeholder="VD: Cổng DVC Tỉnh X" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all focus:bg-white" 
                    aria-describedby="fb-page-name-help"
                  />
                  <p id="fb-page-name-help" className="text-xs text-slate-500">Tên hiển thị cho trang (tùy chọn)</p>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="fb-access-token" className="text-sm font-semibold text-slate-700">Page Access Token</label>
                <div className="relative">
                  <input 
                    id="fb-access-token"
                    type={showFbToken ? "text" : "password"} 
                    value={fbConfig.accessToken} 
                    onChange={(e) => setFbConfig({...fbConfig, accessToken: e.target.value})} 
                    placeholder="EAA..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none pr-10 transition-all focus:bg-white" 
                    required 
                    aria-describedby="fb-access-token-help"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowFbToken(!showFbToken)} 
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    aria-label={showFbToken ? "Ẩn token" : "Hiển thị token"}
                  >
                    {showFbToken ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <p id="fb-access-token-help" className="text-xs text-slate-500">Lưu ý: Token cần quyền <code>pages_messaging</code> và <code>pages_read_engagement</code>.</p>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isConnectingFb} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 w-full md:w-auto">
                  {isConnectingFb ? <RefreshCw size={18} className="animate-spin" /> : <Link size={18} />}
                  {isConnectingFb ? 'Đang xác thực...' : 'Kết nối & Đồng bộ'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-inner">
                 <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><Shield size={16} className="text-green-600" /> Trạng thái kết nối</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Page ID</span><div className="text-slate-900 font-mono mt-1 text-sm bg-white p-2 rounded border border-slate-200 break-all">{fbConfig.pageId}</div></div>
                    <div><span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Trạng thái</span><div className="text-green-600 mt-1 flex items-center gap-1.5 text-sm font-medium">Đang lắng nghe tin nhắn</div></div>
                 </div>
            </div>
          )}
        </div>
       </div>

       {/* Webhook Section */}
       <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
         <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-purple-100 rounded-xl"><RefreshCw size={24} className="text-purple-700" /></div>
            <div><h3 className="text-lg font-bold text-slate-900">Cấu hình Webhook</h3><p className="text-slate-500 text-sm">Thông tin Callback cho Meta App Dashboard.</p></div>
         </div>
         <div className="space-y-5">
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Callback URL</label>
                <div className="flex flex-col md:flex-row gap-2">
                    <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-600 font-mono text-sm break-all" aria-label="Callback URL">{window.location.origin}/webhooks/facebook</code>
                    <button onClick={() => copyToClipboard(`${window.location.origin}/webhooks/facebook`, 'url')} className={`px-4 py-3 md:py-0 border rounded-lg transition-all flex items-center justify-center gap-2 ${copiedField === 'url' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'}`} aria-label={copiedField === 'url' ? "Đã sao chép" : "Sao chép URL"}>{copiedField === 'url' ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />} <span className="md:hidden">Sao chép</span></button>
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Verify Token</label>
                <div className="flex flex-col md:flex-row gap-2">
                    <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-600 font-mono text-sm break-all">dvc_verify_token_2024_secure</code>
                    <button onClick={() => copyToClipboard('dvc_verify_token_2024_secure', 'token')} className={`px-4 py-3 md:py-0 border rounded-lg transition-all flex items-center justify-center gap-2 ${copiedField === 'token' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'}`}>{copiedField === 'token' ? <Check size={18} /> : <Copy size={18} />} <span className="md:hidden">Sao chép</span></button>
                </div>
            </div>
         </div>
       </div>
    </div>
  );

  const renderModels = () => (
    <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Nhà cung cấp Mô hình AI</h3>
                <p className="text-slate-500 text-sm">Cấu hình API Key và chọn mô hình xử lý.</p>
            </div>
            <div className="divide-y divide-slate-100">
                {models.map((model) => (
                    <div key={model.id} className="p-6 flex flex-col md:flex-row items-start gap-6 hover:bg-slate-50 transition-colors">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${model.isActive ? 'bg-blue-600' : 'bg-slate-100'}`}>
                            <Cpu size={24} className={model.isActive ? 'text-white' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 space-y-3 w-full">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-base">{model.name}</h4>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{model.provider}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={model.isActive} onChange={() => toggleModelActive(model.id)} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {model.isActive && (
                                <div className="animate-in slide-in-from-top-2 grid grid-cols-1 gap-4">
                                    <div className="space-y-1">
                                         <label className="text-xs font-semibold text-slate-500">Mã Mô hình (Model ID)</label>
                                         <input
                                            type="text"
                                            value={model.modelString}
                                            onChange={(e) => updateModelField(model.id, 'modelString', e.target.value)}
                                            placeholder="VD: gemini-1.5-pro, gpt-4o"
                                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-800 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500">Khóa API</label>
                                        <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-slate-500 text-sm italic">
                                            Đã cấu hình từ biến môi trường
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Khóa API được lấy từ biến môi trường trên hệ thống</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between">
                {lastSaved && (
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                        <Zap size={14} />
                        Đã lưu lần cuối: {lastSaved.toLocaleTimeString('vi-VN')}
                    </div>
                )}
                <button
                    onClick={saveModels}
                    disabled={savingModels}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95"
                >
                    {savingModels ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Lưu Cấu hình
                </button>
            </div>
        </div>
    </div>
  );

  const renderRoles = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Phân vai AI</h3>
              <p className="text-slate-500 text-sm">Chỉ định mô hình xử lý cho từng tác vụ cụ thể.</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { id: 'chatbotText', label: 'Chatbot (Văn bản)', icon: <MessageSquare size={18} /> },
                { id: 'chatbotVision', label: 'Xử lý Hình ảnh', icon: <ImageIcon size={18} /> },
                { id: 'chatbotAudio', label: 'Xử lý Giọng nói', icon: <Headphones size={18} /> },
                { id: 'rag', label: 'Truy vấn Dữ liệu (RAG)', icon: <Database size={18} /> },
                { id: 'analysis', label: 'Phân tích Hệ thống', icon: <Activity size={18} /> },
                { id: 'sentiment', label: 'Phân tích Cảm xúc', icon: <User size={18} /> },
              ].map((role) => (
                <div key={role.id} className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      {role.icon} {role.label}
                   </label>
                   <div className="relative">
                      <select 
                        value={roles[role.id as keyof typeof roles]} 
                        onChange={(e) => setRoles(prev => ({ ...prev, [role.id]: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 appearance-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      >
                        {models.map(m => (
                            <option key={m.id} value={m.id} disabled={!m.isActive}>
                                {m.name} {!m.isActive ? '(Chưa kích hoạt)' : ''}
                            </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-900">System Prompt</h3>
                    <p className="text-slate-500 text-sm">Chỉ thị cốt lõi cho AI.</p>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <textarea 
                        value={roles.systemPrompt}
                        onChange={(e) => setRoles({...roles, systemPrompt: e.target.value})}
                        className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none min-h-[300px]"
                        placeholder="Nhập chỉ thị hệ thống..."
                    />
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={async () => {
                                try {
                                    const response = await fetch('/api/roles', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(roles)
                                    });

                                    const result = await response.json();

                                    if (result.success) {
                                        showToast('Đã cập nhật System Prompt', 'success');
                                        setLastSaved(new Date());
                                    } else {
                                        showToast('Lưu System Prompt thất bại.', 'error');
                                    }
                                } catch (error) {
                                    console.error('Error saving roles:', error);
                                    showToast('Lỗi kết nối máy chủ khi lưu System Prompt.', 'error');
                                }
                            }}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 flex items-center gap-2"
                        >
                            <Save size={14} />
                            Lưu Chỉ thị
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="text-blue-600" size={24} /> Cấu hình Hệ thống
          </h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý kết nối, mô hình AI và phân quyền truy cập.</p>
        </div>
        {lastSaved && (
            <div className="text-xs text-slate-400 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              Đã lưu: {lastSaved.toLocaleTimeString('vi-VN')}
            </div>
        )}
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto no-scrollbar">
        {[
            { id: 'integrations', label: 'Kết nối', icon: <Link size={18} /> },
            { id: 'models', label: 'Mô hình AI', icon: <Cpu size={18} /> },
            { id: 'roles', label: 'Phân vai & Prompt', icon: <Layers size={18} /> },
            { id: 'test', label: 'Kiểm thử Chat', icon: <Play size={18} /> },
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-5 py-3 text-sm font-semibold flex items-center gap-2.5 rounded-t-lg transition-all relative top-[1px] whitespace-nowrap ${
                    activeTab === tab.id 
                    ? 'text-blue-600 bg-white border border-slate-200 border-b-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'
                }`}
            >
                {tab.icon} {tab.label}
            </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'integrations' && renderIntegrations()}
        {activeTab === 'models' && renderModels()}
        {activeTab === 'roles' && renderRoles()}
        {activeTab === 'test' && (
            <div className="bg-white rounded-2xl border border-slate-200 h-[600px] flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Play size={20} className="text-green-600" /> Kiểm thử Kịch bản</h3>
                    <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full truncate max-w-[150px]">Model: {models.find(m => m.id === roles.chatbotText)?.name}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                    {testMessages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'bot' && (
                                <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                                    <Bot size={16} className="text-white" />
                                </div>
                            )}
                            <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed max-w-[85%] whitespace-pre-line ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-sm' 
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                            }`}>
                                {msg.text}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center shrink-0 shadow-sm">
                                    <User size={16} className="text-slate-500" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isTestSending && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                                <Bot size={16} className="text-white" />
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-1.5 rounded-tl-sm">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="flex gap-3">
                        <input 
                            type="text" 
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTestSend()}
                            placeholder="Nhập câu hỏi thủ tục hành chính..." 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-5 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                        />
                        <button 
                            onClick={handleTestSend} 
                            disabled={!testInput.trim() || isTestSending} 
                            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;