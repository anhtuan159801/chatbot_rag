import React, { useState, useEffect, useMemo } from "react";
import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  User,
  Bot,
  Search,
  MoreHorizontal,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  Link,
  Filter,
  RefreshCw,
} from "lucide-react";
import { ChatSession } from "~shared/types";
import { MOCK_SESSIONS } from "../services/mockData";

interface ChatHistoryViewProps {
  fbConfig?: { pageName: string; pageId: string; accessToken: string };
}

const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({ fbConfig }) => {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null,
  );
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Closed">(
    "all",
  );

  // Check connection status
  const isConnected = !!(fbConfig?.accessToken && fbConfig?.pageId);

  useEffect(() => {
    if (isConnected) {
      setIsLoading(true);
      setError(null);
      // Simulate API call with mock data
      setTimeout(() => {
        setSessions(MOCK_SESSIONS);
        setIsLoading(false);
      }, 1000);
    } else {
      setSessions([]);
    }
  }, [isConnected, fbConfig]);

  // Filter sessions based on search term and status
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesSearch =
        session.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || session.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, statusFilter]);

  // Helper to handle session selection
  const handleSelectSession = (session: ChatSession) => {
    setSelectedSession(session);
  };

  // Helper to go back to list (for mobile)
  const handleBackToList = () => {
    setSelectedSession(null);
  };

  // Refresh sessions
  const handleRefresh = () => {
    if (isConnected) {
      setIsLoading(true);
      setError(null);
      // Simulate API call with mock data
      setTimeout(() => {
        setSessions(MOCK_SESSIONS);
        setIsLoading(false);
      }, 1000);
    }
  };

  // --- Render for Unconnected State ---
  if (!isConnected) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm text-center p-8">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <AlertTriangle size={40} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Chưa kết nối Fanpage
        </h2>
        <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
          Để xem lịch sử tư vấn, hệ thống yêu cầu kết nối trực tiếp với Fanpage
          Facebook. Vui lòng cập nhật cấu hình Access Token và Page ID.
        </p>
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
            <Link size={18} />
            Đến trang Cấu hình
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lịch sử Tư vấn</h2>
          <p className="text-slate-500 text-sm">
            Theo dõi các cuộc trò chuyện với công dân qua Facebook Messenger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            {isLoading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1">
        {/* Session List - Hidden on mobile if session is selected */}
        <div
          className={`w-full md:w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all ${
            selectedSession ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 mb-3 md:hidden">
              Hội thoại Facebook
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-3 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm công dân..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                  aria-label="Tìm kiếm công dân"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "all" | "Active" | "Closed",
                    )
                  }
                  className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="Active">Đang hỗ trợ</option>
                  <option value="Closed">Đã đóng</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center h-64">
                <RefreshCw size={20} className="animate-spin mr-2" />
                Đang đồng bộ dữ liệu...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {sessions.length === 0
                  ? "Chưa có hội thoại nào."
                  : "Không tìm thấy hội thoại phù hợp."}
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`p-4 border-b border-slate-50 cursor-pointer transition-all active:bg-slate-100 ${
                    selectedSession?.id === session.id
                      ? "bg-blue-50 border-l-4 border-l-blue-600"
                      : "hover:bg-slate-50 border-l-4 border-l-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`font-semibold ${selectedSession?.id === session.id ? "text-blue-700" : "text-slate-800"}`}
                    >
                      {session.userName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {session.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {session.lastMessage}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-medium">
                      Facebook
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${session.status === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                    >
                      {session.status === "Active" ? "Đang hỗ trợ" : "Đã đóng"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail View - Hidden on mobile if no session selected */}
        <div
          className={`w-full md:flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden ${
            selectedSession ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedSession ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-3">
                  {/* Back button for mobile */}
                  <button
                    onClick={handleBackToList}
                    className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"
                    aria-label="Trở lại danh sách"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-white shadow-sm shrink-0">
                    <User size={20} className="text-slate-500" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-slate-900 truncate">
                      {selectedSession.userName}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      Messenger • {selectedSession.id}
                    </p>
                  </div>
                </div>
                <button
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Tùy chọn khác"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50">
                <div className="flex justify-center">
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full">
                    {selectedSession.timestamp}
                  </span>
                </div>

                <div className="flex gap-3 justify-end group pl-8">
                  <div className="space-y-1 text-right w-full">
                    <div className="bg-blue-600 text-white p-3.5 rounded-2xl rounded-tr-sm shadow-sm inline-block text-left">
                      <p className="text-sm leading-relaxed">
                        {selectedSession.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 group pr-8">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-md mt-1">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="space-y-2 w-full">
                    <div className="bg-white border border-slate-200 text-slate-800 p-4 rounded-2xl rounded-tl-sm shadow-sm inline-block">
                      <p className="text-sm leading-relaxed">
                        [Hệ thống tự động phản hồi] <br />
                        Chào bạn {selectedSession.userName}, cảm ơn bạn đã liên
                        hệ Cổng Dịch vụ công. Cán bộ chuyên trách sẽ sớm phản
                        hồi tin nhắn của bạn.
                      </p>
                    </div>
                    <div className="bg-white border border-indigo-100 rounded-lg p-3 max-w-[90%]">
                      <div className="flex items-center gap-2 mb-2 text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                        <Sparkles size={12} />
                        AI Suggestion
                      </div>
                      <div className="text-xs text-slate-500 font-mono pl-2 border-l-2 border-indigo-200 truncate">
                        Intent: General Inquiry | Confidence: 98%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-white">
                <p className="text-center text-xs text-slate-400 font-medium">
                  Dữ liệu được đồng bộ từ Facebook Graph API
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <MessageSquare size={32} className="opacity-50" />
              </div>
              <p className="font-medium">Chọn một hội thoại để xem chi tiết</p>
              <p className="text-sm text-slate-400 mt-1">
                Danh sách sẽ hiển thị các cuộc trò chuyện đã được đồng bộ từ
                Facebook
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistoryView;
