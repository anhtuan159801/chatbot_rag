import React, { useState, useEffect } from 'react';
import { Search, Phone, MessageSquare, Mail, Plus, Edit3, Trash2, X, Save } from 'lucide-react';
import { Member } from '../types';
import { useToast } from './Toast';

const MemberDirectoryView: React.FC = () => {
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>(() => {
    // Try to load from localStorage, fallback to mock data
    const saved = localStorage.getItem('memberDirectory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading members from localStorage:', e);
      }
    }
    
    // Default mock data for KP69 community board
    return [
      {
        id: '1',
        name: 'Nguyễn Văn A',
        position: 'Trưởng khu phố',
        role: 'Quản lý chung',
        phone: '+84 987 654 321',
        email: 'truongkupho@example.com',
        facebookId: 'nguyenvana',
        department: 'Ban điều hành khu phố',
        tasks: ['Quản lý an ninh', 'Phối hợp với công an', 'Giải quyết tranh chấp'],
      },
      {
        id: '2',
        name: 'Trần Thị B',
        position: 'Phó khu phố',
        role: 'Tài chính',
        phone: '+84 976 543 210',
        email: 'phokuphotaichinh@example.com',
        facebookId: 'tranthib',
        department: 'Ban điều hành khu phố',
        tasks: ['Quản lý tài chính', 'Thu phí dịch vụ', 'Lập báo cáo tài chính'],
      },
      {
        id: '3',
        name: 'Lê Văn C',
        position: 'Phó khu phố',
        role: 'Văn hóa - Xã hội',
        phone: '+84 965 432 109',
        email: 'phokuphovxh@example.com',
        facebookId: 'levanc',
        department: 'Ban điều hành khu phố',
        tasks: ['Tuyên truyền', 'Văn hóa văn nghệ', 'Phong trào địa phương'],
      },
      {
        id: '4',
        name: 'Phạm Thị D',
        position: 'Thành viên',
        role: 'Phụ trách Nữ công',
        phone: '+84 954 321 098',
        email: 'nucong@example.com',
        facebookId: 'phamthid',
        department: 'Ban điều hành khu phố',
        tasks: ['Phụ nữ - Gia đình', 'Hội phụ nữ', 'Chăm sóc người cao tuổi'],
      },
      {
        id: '5',
        name: 'Hoàng Văn E',
        position: 'Thành viên',
        role: 'An ninh trật tự',
        phone: '+84 943 210 987',
        email: 'antoan@example.com',
        facebookId: 'hoangvane',
        department: 'Ban điều hành khu phố',
        tasks: ['Giám sát an ninh', 'Phối hợp tuần tra', 'Báo cáo sự việc'],
      }
    ];
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMember, setNewMember] = useState<Omit<Member, 'id'>>({
    name: '',
    position: '',
    role: '',
    phone: '',
    email: '',
    facebookId: '',
    department: '',
    tasks: [''],
  });

  // Save to localStorage whenever members change
  useEffect(() => {
    localStorage.setItem('memberDirectory', JSON.stringify(members));
  }, [members]);

  // Filter members based on search term
  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm) ||
    (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddMember = () => {
    setEditingMember(null);
    setNewMember({
      name: '',
      position: '',
      role: '',
      phone: '',
      email: '',
      department: '',
      tasks: [''],
    });
    setShowAddEditModal(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setNewMember({
      name: member.name,
      position: member.position,
      role: member.role,
      phone: member.phone,
      email: member.email || '',
      facebookId: member.facebookId || '',
      department: member.department || '',
      tasks: member.tasks,
    });
    setShowAddEditModal(true);
  };

  const handleDeleteMember = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa thành viên này?')) {
      setMembers(members.filter(member => member.id !== id));
      showToast('Đã xóa thành viên', 'success');
    }
  };

  const handleSaveMember = () => {
    if (editingMember) {
      // Update existing member
      setMembers(members.map(m => 
        m.id === editingMember.id ? { ...editingMember, ...newMember } : m
      ));
      showToast('Cập nhật thành viên thành công', 'success');
    } else {
      // Add new member
      const memberToAdd: Member = {
        ...newMember,
        id: Date.now().toString(),
      };
      setMembers([...members, memberToAdd]);
      showToast('Thêm thành viên thành công', 'success');
    }
    setShowAddEditModal(false);
  };

  const handleSendMessage = (member: Member) => {
    // Try to open Facebook Messenger directly or copy contact info
    const message = `Xin chào ${member.name}, tôi là công dân khu phố 69, tôi cần hỗ trợ về...`;

    // Check if we have a Facebook ID for direct messaging
    if (member.facebookId) {
      // Create Facebook Messenger URL
      const fbLink = `https://www.facebook.com/messages/t/${member.facebookId}`;
      // In a real implementation, we would open the Facebook Messenger app
      window.open(fbLink, '_blank');
      showToast(`Đang mở tin nhắn Facebook đến ${member.name}`, 'info');
    } else if (member.email) {
      // Fallback to email if no Facebook ID
      const emailLink = `mailto:${member.email}?subject=Liên hệ hỗ trợ khu phố&body=${encodeURIComponent(message)}`;
      window.open(emailLink, '_blank');
      showToast(`Đang mở email đến ${member.email}`, 'info');
    } else {
      // Copy phone number to clipboard if no other contact method
      navigator.clipboard.writeText(member.phone);
      showToast(`Đã sao chép số điện thoại: ${member.phone}`, 'info');
    }
  };

  const addTaskField = () => {
    setNewMember({
      ...newMember,
      tasks: [...newMember.tasks, ''],
    });
  };

  const updateTaskField = (index: number, value: string) => {
    const updatedTasks = [...newMember.tasks];
    updatedTasks[index] = value;
    setNewMember({
      ...newMember,
      tasks: updatedTasks,
    });
  };

  const removeTaskField = (index: number) => {
    const updatedTasks = newMember.tasks.filter((_, i) => i !== index);
    setNewMember({
      ...newMember,
      tasks: updatedTasks,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Danh bạ Ban Điều hành Khu phố 69</h2>
          <p className="text-slate-500 text-sm mt-1">
            Liên hệ trực tiếp với các thành viên trong ban điều hành khu phố để được hỗ trợ chính xác nhất
          </p>
        </div>
        <button
          onClick={handleAddMember}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95"
        >
          <Plus size={18} />
          Thêm thành viên
        </button>
      </div>

      {/* Info message */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700 mt-0.5">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 mb-1">Liên hệ hỗ trợ</h3>
            <p className="text-blue-700 text-sm">
              Nếu bạn là người dân tại khu phố 69, bạn có thể liên hệ đến các đồng chí: 
              {members.map((member, index) => (
                <span key={member.id}>
                  {member.name} - {member.position} - {member.phone}
                  {index < members.length - 1 && ', '}
                </span>
              ))} để được hỗ trợ chính xác nhất về các vấn đề liên quan đến khu phố.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Tìm kiếm thành viên theo tên, vị trí, số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            aria-label="Tìm kiếm thành viên"
          />
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-slate-400 mb-4">Không tìm thấy thành viên phù hợp</div>
            <button
              onClick={handleAddMember}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Thêm thành viên đầu tiên
            </button>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300">
                      <span className="text-lg font-bold text-slate-600">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{member.name}</h3>
                      <p className="text-slate-500 text-sm">{member.position}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        {member.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone size={16} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{member.phone}</span>
                  </div>
                  
                  {member.email && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <Mail size={16} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  
                  {member.department && (
                    <div className="text-sm text-slate-500">
                      <span className="font-medium">Ban:</span> {member.department}
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nhiệm vụ</div>
                    <ul className="space-y-1">
                      {member.tasks.map((task, index) => (
                        <li key={index} className="text-sm text-slate-600 flex items-start gap-1.5">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"></span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => handleSendMessage(member)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <MessageSquare size={16} />
                    Nhắn qua Facebook
                  </button>
                  <button
                    onClick={() => handleEditMember(member)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-900">
                {editingMember ? 'Chỉnh sửa thành viên' : 'Thêm thành viên mới'}
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"
                aria-label="Đóng cửa sổ"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Họ và tên</label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                  placeholder="Nhập họ và tên"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Vị trí</label>
                  <input
                    type="text"
                    value={newMember.position}
                    onChange={(e) => setNewMember({...newMember, position: e.target.value})}
                    placeholder="Ví dụ: Trưởng khu phố"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Vai trò</label>
                  <input
                    type="text"
                    value={newMember.role}
                    onChange={(e) => setNewMember({...newMember, role: e.target.value})}
                    placeholder="Ví dụ: Quản lý chung"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Số điện thoại</label>
                <input
                  type="tel"
                  value={newMember.phone}
                  onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                  placeholder="Nhập số điện thoại"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email (Tùy chọn)</label>
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                    placeholder="Nhập địa chỉ email"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Facebook ID (Tùy chọn)</label>
                  <input
                    type="text"
                    value={newMember.facebookId}
                    onChange={(e) => setNewMember({...newMember, facebookId: e.target.value})}
                    placeholder="Nhập Facebook ID"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Bộ phận/Ban (Tùy chọn)</label>
                <input
                  type="text"
                  value={newMember.department}
                  onChange={(e) => setNewMember({...newMember, department: e.target.value})}
                  placeholder="Nhập tên bộ phận"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">Nhiệm vụ</label>
                  <button
                    type="button"
                    onClick={addTaskField}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Thêm nhiệm vụ
                  </button>
                </div>
                <div className="space-y-2">
                  {newMember.tasks.map((task, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => updateTaskField(index, e.target.value)}
                        placeholder="Mô tả nhiệm vụ"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                      {newMember.tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTaskField(index)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowAddEditModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveMember}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <Save size={16} className="inline mr-1" />
                {editingMember ? 'Cập nhật' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDirectoryView;