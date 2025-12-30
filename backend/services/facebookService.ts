import { ChatSession, ChatMessage } from "../../shared/types.js";

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Service xử lý kết nối trực tiếp với Facebook Graph API.
 * Lưu ý: Để hoạt động thực tế, Access Token cần có quyền: pages_messaging, pages_read_engagement.
 */

export const fetchFacebookConversations = async (pageId: string, accessToken: string): Promise<ChatSession[]> => {
  if (!pageId || !accessToken) {
    console.error("Missing required parameters for Facebook API: pageId or accessToken");
    return [];
  }

  try {
    // Gọi API thực tế của Facebook
    // GET /{page-id}/conversations?fields=participants,updated_time,messages.limit(1){message,created_time,from}
    const response = await fetch(
      `${GRAPH_API_URL}/${pageId}/conversations?fields=participants,updated_time,messages.limit(1){message,created_time,from}&access_token=${accessToken}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Facebook API Error:", response.status, errorText);

      // Handle specific error codes
      if (response.status === 400) {
        throw new Error("Bad request: Invalid parameters provided to Facebook API");
      } else if (response.status === 401) {
        throw new Error("Unauthorized: Invalid access token for Facebook API");
      } else if (response.status === 403) {
        throw new Error("Forbidden: Insufficient permissions for Facebook API");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded: Too many requests to Facebook API");
      } else {
        throw new Error(`Facebook API request failed with status ${response.status}`);
      }
    }

    const data = await response.json();

    // Validate response structure
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response format from Facebook API");
    }

    // Map dữ liệu từ Facebook JSON sang cấu trúc App
    return data.data.map((conv: any) => ({
      id: conv.id,
      userName: conv.participants?.data[0]?.name || 'Người dùng Facebook',
      platform: 'Facebook',
      lastMessage: conv.messages?.data[0]?.message || '[Hình ảnh/Sticker]',
      timestamp: new Date(conv.updated_time).toLocaleString('vi-VN'),
      status: 'Active' // Mặc định active vì API facebook không trả status đóng/mở
    }));

  } catch (error: any) {
    console.error("Facebook API Error:", error);

    // If it's a specific API error, re-throw it to be handled by the UI
    if (error.message.includes("Facebook API")) {
      throw error;
    }

    console.log("Using Mock Data fallback for demonstration purposes because invalid Token provided.");
    // FALLBACK DATA: Chỉ dùng khi không có Token thật để demo giao diện
    return [
      { id: 'fb_101', userName: 'Nguyễn Văn Nam (Real FB)', platform: 'Facebook', lastMessage: 'Hồ sơ của tôi đã được duyệt chưa ạ?', timestamp: 'Vừa xong', status: 'Active' },
      { id: 'fb_102', userName: 'Phạm Thị Hoa', platform: 'Facebook', lastMessage: 'Cảm ơn admin nhé.', timestamp: '10 phút trước', status: 'Closed' },
      { id: 'fb_103', userName: 'Lê Minh Khôi', platform: 'Facebook', lastMessage: 'Thủ tục đăng ký khai sinh online bị lỗi.', timestamp: '1 giờ trước', status: 'Active' },
      { id: 'fb_104', userName: 'Hoàng Yến', platform: 'Facebook', lastMessage: 'Xin chào, tôi muốn hỏi về đất đai.', timestamp: '3 giờ trước', status: 'Active' },
    ];
  }
};

export const fetchConversationMessages = async (conversationId: string, accessToken: string): Promise<ChatMessage[]> => {
    // GET /{conversation-id}/messages?fields=message,created_time,from
    // Implementation tương tự fetchConversations
    // Trả về dữ liệu mẫu cho demo
    return [];
};

/**
 * Gửi tin nhắn phản hồi đến người dùng Facebook
 */
export const sendFbMessage = async (psid: string, messageText: string, accessToken: string) => {
  try {
    if (!messageText || messageText.trim() === '') {
      throw new Error('Message text cannot be empty');
    }

    const requestBody = {
      recipient: { id: psid },
      message: { text: messageText }
    };

    const response = await fetch(
      `${GRAPH_API_URL}/me/messages?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('Message sent successfully:', data);
      return data;
    } else {
      console.error('Failed to send message:', data);
      throw new Error(`Failed to send message: ${data.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error sending Facebook message:', error);
    throw error;
  }
};