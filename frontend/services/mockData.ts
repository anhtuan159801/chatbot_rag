import { ChatSession, DocumentType, IngestionStatus, KnowledgeDocument, SystemMetrics, SystemStatus } from "~shared/types.js";

export const MOCK_METRICS: SystemMetrics = {
  totalVectors: 25890,
  activeChats: 156,
  systemHealth: SystemStatus.HEALTHY,
  apiLatencyMs: 180,
  dailyRequests: 3450,
};

export const MOCK_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: '1',
    name: 'Luat_Can_Cuoc_Cong_Dan_2023.pdf',
    type: DocumentType.PDF,
    status: IngestionStatus.COMPLETED,
    uploadDate: '2023-10-25T10:00:00Z',
    vectorCount: 890,
    size: '5.2 MB'
  },
  {
    id: '2',
    name: 'https://dichvucong.gov.vn/thu-tuc-dat-dai',
    type: DocumentType.WEB_CRAWL,
    status: IngestionStatus.COMPLETED,
    uploadDate: '2023-10-26T09:30:00Z',
    vectorCount: 340,
    size: '250 KB'
  },
  {
    id: '3',
    name: 'Nghi_dinh_13_Bao_ve_Du_lieu_Ca_nhan.docx',
    type: DocumentType.DOCX,
    status: IngestionStatus.VECTORIZING,
    uploadDate: '2023-10-27T14:15:00Z',
    vectorCount: 0,
    size: '1.8 MB'
  }
];

export const MOCK_SESSIONS: ChatSession[] = [
  { id: '101', userName: 'Nguyễn Văn An', platform: 'Facebook', lastMessage: 'Thủ tục cấp đổi hộ chiếu online cần giấy tờ gì?', timestamp: '2 phút trước', status: 'Active' },
  { id: '102', userName: 'Trần Thị Bình', platform: 'Facebook', lastMessage: 'Cảm ơn cán bộ đã hướng dẫn.', timestamp: '15 phút trước', status: 'Closed' },
  { id: '103', userName: 'Lê Văn Cường', platform: 'Facebook', lastMessage: 'Lỗi khi nộp lệ phí trước bạ xe máy.', timestamp: '1 giờ trước', status: 'Active' },
];

export const GRAPH_DATA = [
  { name: '07:00', requests: 120, errors: 1 },
  { name: '09:00', requests: 450, errors: 5 },
  { name: '11:00', requests: 380, errors: 2 },
  { name: '13:00', requests: 200, errors: 0 },
  { name: '15:00', requests: 520, errors: 8 },
  { name: '17:00', requests: 300, errors: 3 },
  { name: '20:00', requests: 150, errors: 1 },
];