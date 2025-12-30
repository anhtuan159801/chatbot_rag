import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Sparkles, Server, Users, Database, Zap, Activity, ShieldCheck, RefreshCw } from 'lucide-react';
import { MOCK_METRICS, GRAPH_DATA } from '../services/mockData';
import { KnowledgeDocument } from '../types';
import { analyzeSystemHealth } from '../services/geminiService';
import { useToast } from './Toast';

interface DashboardViewProps {
  documents: KnowledgeDocument[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ documents }) => {
  const { showToast } = useToast();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Calculate real-time metrics based on the documents prop
  const totalVectors = documents.reduce((sum, doc) => sum + doc.vectorCount, 0);
  const recentDocCount = documents.filter(doc => {
    const date = new Date(doc.uploadDate);
    const now = new Date();
    return (now.getTime() - date.getTime()) < (24 * 60 * 60 * 1000); // 24 hours
  }).length;

  const currentMetrics = {
    ...MOCK_METRICS,
    totalVectors: totalVectors
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    showToast('Đang phân tích dữ liệu hệ thống...', 'info');
    try {
      const result = await analyzeSystemHealth(currentMetrics, documents);
      setAnalysis(result);
      setLastUpdated(new Date());
      showToast('Phân tích hoàn tất', 'success');
    } catch (error: any) {
      const errorMessage = error.message || 'Lỗi phân tích hệ thống';
      showToast(errorMessage, 'error');
      console.error('AI Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefresh = () => {
    showToast('Đang làm mới dữ liệu...', 'info');
    setAnalysis(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tổng quan Hệ thống</h2>
          <p className="text-slate-500 text-sm mt-1">Theo dõi hiệu suất và hoạt động của hệ thống RAG</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">
            Cập nhật lần cuối: <span className="font-medium">{lastUpdated.toLocaleTimeString('vi-VN')}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* AI Analyst & System Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Analyst */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 relative overflow-hidden shadow-sm">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full blur-2xl"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700" aria-hidden="true">
                    <Sparkles size={20} />
                  </div>
                  Trợ lý Giám sát Hệ thống (Gemini AI)
                </h3>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
                  aria-label={isAnalyzing ? "Đang phân tích, vui lòng chờ" : "Phân tích dữ liệu hệ thống"}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>Phân tích nhanh</>
                  )}
                </button>
              </div>
              <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 min-h-[120px]">
                {analysis ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{analysis}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-4">
                     <Activity size={24} className="mb-2 opacity-30" />
                     <p className="text-sm text-center">Nhấn nút "Phân tích nhanh" để nhận báo cáo về tình trạng vector, độ trễ và tải hệ thống.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Health Score / Quick Status */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg" aria-hidden="true">
                    <ShieldCheck size={20} />
                </div>
                <h3 className="font-bold text-slate-800">Độ ổn định</h3>
             </div>

             <div className="text-center py-4">
                 <div className="text-5xl font-black text-emerald-600">98%</div>
                 <p className="text-sm text-slate-500 font-medium mt-1">Hệ thống vận hành tốt</p>
             </div>

             <div className="space-y-3 mt-2">
                 <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Tài nguyên CPU</span>
                    <span className="text-slate-800">12%</span>
                 </div>
                 <div className="w-full bg-slate-100 rounded-full h-1.5" role="progressbar" aria-valuenow={12} aria-valuemin={0} aria-valuemax={100} aria-label="Tải CPU">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '12%' }}></div>
                 </div>
                 <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Bộ nhớ (RAM)</span>
                    <span className="text-slate-800">45%</span>
                 </div>
                 <div className="w-full bg-slate-100 rounded-full h-1.5" role="progressbar" aria-valuenow={45} aria-valuemin={0} aria-valuemax={100} aria-label="Tải RAM">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                 </div>
             </div>
          </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-labelledby="metric1">
          <div className="flex items-center justify-between mb-4">
            <span id="metric1" className="text-slate-500 font-semibold text-sm">Văn bản pháp quy</span>
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700" aria-hidden="true">
                <Database size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900" aria-label={`Tổng số văn bản pháp lý: ${totalVectors.toLocaleString()}`}>{totalVectors.toLocaleString()}</div>
          <div className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">
            <span className="bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[10px]">+{recentDocCount}</span>
            <span className="text-slate-400">tài liệu mới</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-labelledby="metric2">
          <div className="flex items-center justify-between mb-4">
            <span id="metric2" className="text-slate-500 font-semibold text-sm">Phiên tư vấn</span>
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700" aria-hidden="true">
                <Users size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900" aria-label={`Số phiên tư vấn đang hoạt động: ${MOCK_METRICS.activeChats}`}>{MOCK_METRICS.activeChats}</div>
          <div className="text-xs font-medium text-slate-400 mt-2">Đang hoạt động trên Messenger</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-labelledby="metric3">
          <div className="flex items-center justify-between mb-4">
            <span id="metric3" className="text-slate-500 font-semibold text-sm">Độ trễ phản hồi</span>
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700" aria-hidden="true">
                <Zap size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900" aria-label={`Độ trễ phản hồi: ${MOCK_METRICS.apiLatencyMs} mili giây`}>{MOCK_METRICS.apiLatencyMs}<span className="text-lg text-slate-400 font-medium">ms</span></div>
          <div className="text-xs font-medium text-emerald-600 mt-2">Tốc độ tối ưu</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow" role="region" aria-labelledby="metric4">
          <div className="flex items-center justify-between mb-4">
            <span id="metric4" className="text-slate-500 font-semibold text-sm">Yêu cầu trong ngày</span>
            <div className="p-2 bg-teal-100 rounded-lg text-teal-700" aria-hidden="true">
                <Server size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900" aria-label={`Số yêu cầu trong ngày: ${MOCK_METRICS.dailyRequests.toLocaleString()}`}>{MOCK_METRICS.dailyRequests.toLocaleString()}</div>
          <div className="text-xs font-medium text-slate-400 mt-2">Cập nhật 1 phút trước</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-900">Lưu lượng Yêu cầu Hỗ trợ</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Tùy chỉnh biểu đồ:</span>
            <select className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1" aria-label="Tùy chỉnh biểu đồ">
              <option>7 ngày gần nhất</option>
              <option>30 ngày gần nhất</option>
              <option>90 ngày gần nhất</option>
            </select>
          </div>
        </div>
        {/* Fix: Container with better responsive height for Recharts */}
        <div style={{ width: '100%', height: 300 }} className="md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={GRAPH_DATA}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{fill: '#64748b', fontSize: 11}}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{fill: '#64748b', fontSize: 11}}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: '#1e293b',
                    padding: '12px'
                }}
                itemStyle={{ color: '#2563eb', fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#2563eb"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRequests)"
                activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;