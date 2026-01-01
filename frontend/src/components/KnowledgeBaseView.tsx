import React, { useState, useMemo, useEffect } from "react";
import {
  Upload,
  FileText,
  Globe,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  X,
  Link as LinkIcon,
  Search,
  SortAsc,
  Filter,
} from "lucide-react";
import {
  DocumentType,
  IngestionStatus,
  KnowledgeDocument,
} from "~shared/types";
import { useToast } from "./Toast";

const KnowledgeBaseView: React.FC = () => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] =
    useState<keyof KnowledgeDocument>("uploadDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch documents from database on mount
  useEffect(() => {
    fetchDocuments();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/knowledge-base");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // Crawl State
  const [showCrawlDialog, setShowCrawlDialog] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState("");

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let result = documents.filter((doc: KnowledgeDocument) =>
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    // Sort documents
    result.sort((a: KnowledgeDocument, b: KnowledgeDocument) => {
      if (a[sortField] < b[sortField]) return sortDirection === "asc" ? -1 : 1;
      if (a[sortField] > b[sortField]) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [documents, searchTerm, sortField, sortDirection]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setIsUploading(true);
      showToast(`Đang tải lên ${files.length} văn bản...`, "info");

      try {
        const uploadPromises = files.map(async (file: File) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("name", file.name);

          const response = await fetch("/api/knowledge-base/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          return await response.json();
        });

        await Promise.all(uploadPromises);
        await fetchDocuments();
        setIsUploading(false);
        showToast(
          `Đã tải lên ${files.length} văn bản thành công. Đang xử lý...`,
          "success",
        );
      } catch (error) {
        console.error("Upload error:", error);
        setIsUploading(false);
        showToast("Lỗi khi tải lên văn bản", "error");
      }

      // Clear input
      e.target.value = "";
    }
  };

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl) return;

    // Basic validation
    if (!crawlUrl.startsWith("http")) {
      showToast(
        "Vui lòng nhập URL hợp lệ (bắt đầu bằng http:// hoặc https://)",
        "error",
      );
      return;
    }

    setShowCrawlDialog(false);
    setIsUploading(true);
    showToast(`Bắt đầu thu thập dữ liệu từ: ${crawlUrl}`, "info");

    try {
      const response = await fetch("/api/knowledge-base/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to crawl webpage");
      }

      const newDoc = await response.json();
      setDocuments((prev) => [newDoc, ...prev]);
      await fetchDocuments();
      setIsUploading(false);
      showToast("Đang thu thập dữ liệu từ trang web...", "info");
    } catch (error) {
      console.error("Crawl error:", error);
      setIsUploading(false);
      showToast("Lỗi khi thu thập dữ liệu web", "error");
    }

    setCrawlUrl("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa văn bản "${name}"? Hành động này sẽ xóa toàn bộ vector liên quan.`,
      )
    ) {
      try {
        const response = await fetch(`/api/knowledge-base/${id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          await fetchDocuments();
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          showToast(`Đã xóa văn bản "${name}".`, "info");
        } else {
          showToast("Lỗi khi xóa văn bản", "error");
        }
      } catch (error) {
        console.error("Delete error:", error);
        showToast("Lỗi khi xóa văn bản", "error");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Xóa ${selectedIds.size} văn bản đã chọn?`)) {
      try {
        const deletePromises = Array.from(selectedIds).map(async (id) => {
          const response = await fetch(`/api/knowledge-base/${id}`, {
            method: "DELETE",
          });
          return response.ok;
        });

        const results = await Promise.all(deletePromises);
        const successCount = results.filter((r) => r).length;

        if (successCount === selectedIds.size) {
          setDocuments((prev) =>
            prev.filter((doc) => !selectedIds.has(doc.id)),
          );
          setSelectedIds(new Set());
          showToast(`Đã xóa ${successCount} văn bản thành công.`, "success");
        } else {
          showToast(
            `Đã xóa ${successCount}/${selectedIds.size} văn bản. Một số văn bản thất bại.`,
            "warning",
          );
        }
      } catch (error) {
        console.error("Bulk delete error:", error);
        showToast("Lỗi khi xóa văn bản", "error");
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(filteredDocuments.map((d: KnowledgeDocument) => d.id)),
      );
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const getStatusColor = (status: IngestionStatus) => {
    switch (status) {
      case IngestionStatus.COMPLETED:
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case IngestionStatus.PROCESSING:
        return "text-blue-700 bg-blue-50 border-blue-200";
      case IngestionStatus.VECTORIZING:
        return "text-purple-700 bg-purple-50 border-purple-200";
      case IngestionStatus.PENDING:
        return "text-amber-700 bg-amber-50 border-amber-200";
      case IngestionStatus.FAILED:
        return "text-red-700 bg-red-50 border-red-200";
      default:
        return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const handleSort = (field: keyof KnowledgeDocument) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: keyof KnowledgeDocument }) => {
    if (sortField !== field) return <SortAsc size={14} className="opacity-0" />;
    return (
      <SortAsc
        size={14}
        className={`ml-1 ${sortDirection === "asc" ? "rotate-180" : ""}`}
      />
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      {isLoading && documents.length === 0 && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
          <span className="ml-3 text-slate-500">Đang tải...</span>
        </div>
      )}

      {/* Crawl Dialog Modal */}
      {showCrawlDialog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe size={20} className="text-blue-600" />
                Thu thập Dữ liệu Web
              </h3>
              <button
                onClick={() => setShowCrawlDialog(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"
                aria-label="Đóng cửa sổ"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCrawl} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">
                  URL Đích
                </label>
                <div className="relative">
                  <LinkIcon
                    size={16}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />
                  <input
                    type="url"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    placeholder="https://dichvucong.gov.vn/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Hệ thống sẽ tự động thu thập thông tin thủ tục từ trang này.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCrawlDialog(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!crawlUrl}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                >
                  Bắt đầu Thu thập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Kho Dữ liệu Pháp lý
          </h2>
          <p className="text-slate-500 text-sm">
            Quản lý văn bản luật, nghị định và hướng dẫn thủ tục hành chính.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Xóa ({selectedIds.size})
            </button>
          )}
          <label className="cursor-pointer px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-2 active:scale-95">
            <Upload size={16} />
            {isUploading ? "Đang tải..." : "Tải Văn bản Luật"}
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
              multiple
            />
          </label>
          <button
            onClick={() => setShowCrawlDialog(true)}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <Globe size={16} />
            Thu thập Web
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-3 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Tìm kiếm văn bản..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            aria-label="Tìm kiếm văn bản"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortField}
            onChange={(e) =>
              handleSort(e.target.value as keyof KnowledgeDocument)
            }
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            aria-label="Sắp xếp theo"
          >
            <option value="name">Sắp xếp theo tên</option>
            <option value="uploadDate">Sắp xếp theo ngày</option>
            <option value="vectorCount">Sắp xếp theo vector</option>
            <option value="size">Sắp xếp theo kích thước</option>
          </select>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredDocuments.length > 0 &&
                      selectedIds.size === filteredDocuments.length
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Tên Văn bản
                    <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center gap-1">
                    Định dạng
                    <SortIcon field="type" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Trạng thái
                    <SortIcon field="status" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                  onClick={() => handleSort("vectorCount")}
                >
                  <div className="flex items-center gap-1">
                    Số Vector
                    <SortIcon field="vectorCount" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                  onClick={() => handleSort("size")}
                >
                  <div className="flex items-center gap-1">
                    Dung lượng
                    <SortIcon field="size" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                  onClick={() => handleSort("uploadDate")}
                >
                  <div className="flex items-center gap-1">
                    Ngày cập nhật
                    <SortIcon field="uploadDate" />
                  </div>
                </th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {documents.length === 0
                      ? "Chưa có văn bản nào. Vui lòng tải lên hoặc thu thập dữ liệu."
                      : "Không tìm thấy văn bản phù hợp với tiêu chí tìm kiếm."}
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.has(doc.id) ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelectOne(doc.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Chọn ${doc.name}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${doc.type === DocumentType.WEB_CRAWL ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"}`}
                        >
                          {doc.type === DocumentType.WEB_CRAWL ? (
                            <Globe size={18} />
                          ) : (
                            <FileText size={18} />
                          )}
                        </div>
                        <div>
                          <span
                            className="font-medium text-slate-800 truncate max-w-[120px] sm:max-w-[150px] md:max-w-[300px] block"
                            title={doc.name}
                          >
                            {doc.name}
                          </span>
                          <div className="md:hidden text-xs text-slate-500 mt-1">
                            <span className="font-semibold">Định dạng:</span>{" "}
                            {doc.type} |
                            <span className="font-semibold ml-1">
                              Trạng thái:
                            </span>{" "}
                            {doc.status === IngestionStatus.COMPLETED
                              ? "Hoàn tất"
                              : doc.status === IngestionStatus.PROCESSING
                                ? "Đang xử lý"
                                : doc.status === IngestionStatus.VECTORIZING
                                  ? "Vector hóa"
                                  : doc.status}{" "}
                            |
                            <span className="font-semibold ml-1">
                              Số Vector:
                            </span>{" "}
                            {doc.vectorCount > 0
                              ? doc.vectorCount.toLocaleString()
                              : "-"}{" "}
                            |
                            <span className="font-semibold ml-1">
                              Dung lượng:
                            </span>{" "}
                            {doc.size}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-[11px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {doc.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(doc.status)} md:hidden`}
                      >
                        {doc.status === IngestionStatus.COMPLETED && (
                          <CheckCircle size={12} />
                        )}
                        {doc.status === IngestionStatus.PROCESSING && (
                          <RefreshCw size={12} className="animate-spin" />
                        )}
                        {doc.status === IngestionStatus.VECTORIZING && (
                          <RefreshCw size={12} className="animate-spin" />
                        )}
                        {doc.status === IngestionStatus.PENDING && (
                          <Clock size={12} />
                        )}
                        {doc.status === IngestionStatus.FAILED && (
                          <AlertCircle size={12} />
                        )}
                        {doc.status === IngestionStatus.COMPLETED
                          ? "Hoàn tất"
                          : doc.status === IngestionStatus.PROCESSING
                            ? "Đang xử lý"
                            : doc.status === IngestionStatus.VECTORIZING
                              ? "Vector hóa"
                              : doc.status}
                      </div>
                      <div
                        className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(doc.status)}`}
                      >
                        {doc.status === IngestionStatus.COMPLETED && (
                          <CheckCircle size={12} />
                        )}
                        {doc.status === IngestionStatus.PROCESSING && (
                          <RefreshCw size={12} className="animate-spin" />
                        )}
                        {doc.status === IngestionStatus.VECTORIZING && (
                          <RefreshCw size={12} className="animate-spin" />
                        )}
                        {doc.status === IngestionStatus.PENDING && (
                          <Clock size={12} />
                        )}
                        {doc.status === IngestionStatus.FAILED && (
                          <AlertCircle size={12} />
                        )}
                        {doc.status === IngestionStatus.COMPLETED
                          ? "Hoàn tất"
                          : doc.status === IngestionStatus.PROCESSING
                            ? "Đang xử lý"
                            : doc.status === IngestionStatus.VECTORIZING
                              ? "Vector hóa"
                              : doc.status}
                      </div>
                    </td>
                    <td className="p-4 text-slate-700 font-mono text-sm hidden md:table-cell">
                      {doc.vectorCount > 0
                        ? doc.vectorCount.toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-4 text-slate-500 text-sm hidden md:table-cell">
                      {doc.size}
                    </td>
                    <td className="p-4 text-slate-500 text-sm flex items-center gap-2 hidden md:table-cell">
                      <Clock size={14} />
                      <span className="whitespace-nowrap">
                        {new Date(doc.uploadDate).toLocaleDateString("vi-VN")}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(doc.id, doc.name);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer relative z-10"
                        title="Xóa văn bản"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseView;
