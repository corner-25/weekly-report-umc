'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, CheckCircle2, KeyRound, Mail, RefreshCw, Send, Settings, ShieldCheck, Stethoscope, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner, PANEL, PRIMARY_BTN } from '@/components/crm/ui';

type SettingsTab = 'email' | 'account';

interface EmailSettingsData {
  smtpConfig: {
    isConfigured: boolean;
    host: string;
    port: number;
    user: string;
    from: string;
    secure: boolean;
  };
  contactInfo: {
    address: string;
    email: string;
    phones: string[];
  };
  previews: {
    workReminder: { subject: string; html: string };
    crmBriefing: { subject: string; html: string };
  };
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>('email');

  // State cho Tab Email
  const [emailData, setEmailData] = useState<EmailSettingsData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'workReminder' | 'crmBriefing'>('workReminder');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [briefingSending, setBriefingSending] = useState(false);
  const [briefingSuccess, setBriefingSuccess] = useState('');

  // State cho Tab Mật khẩu
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const loadEmailSettings = () => {
    setEmailLoading(true);
    setEmailError('');
    crmFetch<EmailSettingsData>('/api/settings/email')
      .then((data) => {
        setEmailData(data);
        if (session?.user?.email && !testEmailTo) {
          setTestEmailTo(session.user.email);
        }
      })
      .catch((err) => {
        setEmailError(errorMessage(err, 'Không tải được dữ liệu mẫu email.'));
      })
      .finally(() => {
        setEmailLoading(false);
      });
  };

  useEffect(() => {
    loadEmailSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTo) return;
    setTestSending(true);
    setTestSuccess('');
    setEmailError('');

    try {
      await crmSend('/api/settings/email', 'POST', {
        toEmail: testEmailTo,
        templateType: selectedTemplate,
      });
      setTestSuccess(`Đã gửi email thử nghiệm mẫu "${selectedTemplate === 'workReminder' ? 'Đôn đốc công việc' : 'Lịch hẹn VIP ngày mai'}" đến ${testEmailTo} thành công.`);
    } catch (err) {
      setEmailError(errorMessage(err, 'Gửi email thử nghiệm thất bại. Vui lòng kiểm tra lại cấu hình SMTP.'));
    } finally {
      setTestSending(false);
    }
  };

  const handleTriggerBriefing = async () => {
    setBriefingSending(true);
    setBriefingSuccess('');
    setEmailError('');

    try {
      const res = await crmSend<{ sent: boolean; guestCount: number; recipients: string[] }>('/api/crm/follow-up-briefing', 'POST');
      if (res.guestCount === 0) {
        setBriefingSuccess('Ngày mai hiện chưa có khách VIP nào có lịch hẹn tái khám / Chụp MRI.');
      } else {
        setBriefingSuccess(`Đã kích hoạt gửi thông báo nội bộ cho ${res.guestCount} khách VIP ngày mai đến các địa chỉ: ${res.recipients.join(', ')}.`);
      }
    } catch (err) {
      setEmailError(errorMessage(err, 'Không thể kích hoạt gửi thông báo nội bộ.'));
    } finally {
      setBriefingSending(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Có lỗi xảy ra');
      } else {
        setSuccess('Đổi mật khẩu thành công!');
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <PageHeader
        icon={Settings}
        title="Thiết lập hệ thống & Mẫu thông báo"
        description="Quản lý mẫu email tự động (UMC-Office & CRM), cấu hình gửi thông báo và tài khoản"
      />

      {/* Tabs chuyển đổi */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'email'
              ? 'border-cyan-600 text-cyan-800 bg-cyan-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Mail className="h-4 w-4" />
          Mẫu Email & Tự động hóa
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'account'
              ? 'border-cyan-600 text-cyan-800 bg-cyan-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <User className="h-4 w-4" />
          Tài khoản & Mật khẩu
        </button>
      </div>

      {activeTab === 'email' && (
        <div className="space-y-6">
          <ErrorBanner message={emailError} />
          {testSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{testSuccess}</span>
            </div>
          )}
          {briefingSuccess && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 text-sm text-teal-800 flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
              <span>{briefingSuccess}</span>
            </div>
          )}

          {/* Khung trạng thái SMTP & Thông tin hành chính */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className={PANEL + ' p-5 space-y-3'}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-600" />
                  Trạng thái kết nối SMTP (Railway Pro)
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    emailData?.smtpConfig.isConfigured
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      emailData?.smtpConfig.isConfigured ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  />
                  {emailData?.smtpConfig.isConfigured ? 'Đã kích hoạt SMTP' : 'Chưa cấu hình biến SMTP'}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 pt-1 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Máy chủ gửi (Host):</span>
                  <span className="font-mono font-medium">{emailData?.smtpConfig.host}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cổng kết nối (Port):</span>
                  <span className="font-mono font-medium">{emailData?.smtpConfig.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tài khoản gửi (User):</span>
                  <span className="font-mono font-medium">{emailData?.smtpConfig.user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Địa chỉ người gửi (From):</span>
                  <span className="font-medium text-slate-800">{emailData?.smtpConfig.from}</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 border border-slate-200/80">
                💡 <em>Để cập nhật mật khẩu hoặc máy chủ mới trên Railway: Vào tab Variables của project và thiết lập: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code>, <code>SMTP_FROM</code>.</em>
              </div>
            </div>

            <div className={PANEL + ' p-5 space-y-3'}>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-4 w-4 text-cyan-600" />
                Thông tin định danh hành chính bệnh viện
              </h3>
              <div className="text-xs text-slate-600 space-y-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block">Đơn vị ban hành:</span>
                  <span className="font-semibold text-slate-800">Phòng Hành chính · Bệnh viện Đại học Y Dược TP.HCM</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Địa chỉ trụ sở:</span>
                  <span className="font-semibold text-slate-800">215 Hồng Bàng, Phường Chợ Lớn, TP. Hồ Chí Minh</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Hộp thư điện tử chính thức:</span>
                  <span className="font-semibold text-cyan-700">hanhchinh@umc.edu.vn</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Điện thoại liên hệ nội bộ:</span>
                  <span className="font-semibold text-slate-800">
                    5421 (Phụ trách Quản lý Công việc) · 5324 (Thư ký Phòng)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Khu vực xem trước & thử nghiệm mẫu email */}
          <div className={PANEL + ' p-5 sm:p-6 space-y-5'}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Xem trước mẫu email chuẩn & Thử nghiệm</h3>
                <p className="text-xs text-slate-500">Mẫu thư được sinh theo tiêu chuẩn HTML trang nhã, tương thích Outlook, Gmail, Apple Mail.</p>
              </div>

              {/* Nút chọn mẫu */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate('workReminder')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    selectedTemplate === 'workReminder'
                      ? 'bg-white text-cyan-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="h-3.5 w-3.5 text-cyan-600" />
                  Mẫu 1: Đôn đốc công việc (UMC-Office)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTemplate('crmBriefing')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    selectedTemplate === 'crmBriefing'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
                  Mẫu 2: Nội bộ tiếp đón VIP ngày mai (CRM)
                </button>
              </div>
            </div>

            {/* Chi tiết về mẫu đang chọn */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2">
              {selectedTemplate === 'workReminder' ? (
                <div>
                  <span className="font-bold text-slate-900 block mb-1">
                    Đặc điểm Mẫu 1 (Đôn đốc tiến độ công việc trên UMC-Office):
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    <li>Gửi cho Thư ký / Đầu mối đơn vị chủ trì khi đến hạn hoặc chậm tiến độ.</li>
                    <li>
                      <strong>Quy chuẩn bắt buộc 4 tiêu chí báo cáo:</strong> Kết quả cụ thể, số liệu định lượng & minh chứng văn bản, tiến độ & khó khăn, và điều kiện chuyển trạng thái Hoàn thành.
                    </li>
                    <li>Thông tin liên hệ chuẩn mực: 215 Hồng Bàng, Phường Chợ Lớn, TP.HCM, email hanhchinh@umc.edu.vn, ĐT: 5421 & 5324.</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-teal-900 block mb-1">
                    Đặc điểm Mẫu 2 (Thông báo nội bộ đón khách tái khám / Chụp MRI / CLS ngày N+1):
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-teal-800">
                    <li>Gửi nội bộ cho đội ngũ nhân viên Phòng Hành chính & Tiếp đón VIP vào đầu ngày hoặc cuối buổi chiều hôm trước.</li>
                    <li>Tổng hợp toàn bộ danh sách khách VIP có lịch hẹn ngày mai, bác sĩ khám, phòng chụp MRI, nhân viên dẫn chính & người đi cùng.</li>
                    <li>Nhắc nhở nhân viên chủ động liên hệ trước với khách và phối hợp khoa phòng để đón tiếp chu đáo tại Sảnh A/Quầy VIP.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Khung thao tác gửi thử & kích hoạt */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-cyan-50/60 border border-cyan-200/80">
              <form onSubmit={handleSendTestEmail} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-cyan-950">Gửi thử mẫu này đến:</span>
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="nhap-email@umc.edu.vn"
                  className="px-3 py-1.5 text-xs rounded-lg border border-cyan-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 w-60"
                  required
                />
                <button
                  type="submit"
                  disabled={testSending || !emailData?.smtpConfig.isConfigured}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 text-white text-xs font-semibold hover:bg-cyan-800 transition shadow-xs disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  {testSending ? 'Đang gửi...' : 'Gửi thử nghiệm qua SMTP'}
                </button>
              </form>

              {selectedTemplate === 'crmBriefing' && (
                <button
                  type="button"
                  onClick={handleTriggerBriefing}
                  disabled={briefingSending || !emailData?.smtpConfig.isConfigured}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition shadow-xs disabled:opacity-50"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {briefingSending ? 'Đang gửi...' : 'Kích hoạt gửi thông báo VIP ngày mai ngay'}
                </button>
              )}
            </div>

            {/* Khung Live Preview */}
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-slate-100 p-2 sm:p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 px-2">
                <span className="font-medium">
                  Tiêu đề email:{' '}
                  <strong className="text-slate-800">
                    {selectedTemplate === 'workReminder'
                      ? emailData?.previews.workReminder.subject
                      : emailData?.previews.crmBriefing.subject}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={loadEmailSettings}
                  className="hover:text-cyan-700 inline-flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="h-3 w-3" /> Làm mới
                </button>
              </div>

              {emailLoading ? (
                <div className="h-96 flex items-center justify-center text-slate-400 text-sm">
                  Đang tải nội dung xem trước...
                </div>
              ) : (
                <iframe
                  title="Xem trước mẫu email"
                  srcDoc={
                    selectedTemplate === 'workReminder'
                      ? emailData?.previews.workReminder.html
                      : emailData?.previews.crmBriefing.html
                  }
                  className="w-full h-[620px] rounded-lg bg-white border border-slate-200 shadow-inner"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* User Info */}
          <div className={PANEL + ' p-6'}>
            <h2 className="text-lg font-bold mb-3 text-slate-900 flex items-center gap-2">
              <User className="h-5 w-5 text-cyan-600" />
              Thông tin tài khoản
            </h2>
            <div className="space-y-2 text-slate-700 text-sm">
              <p>
                <span className="font-semibold text-slate-500">Email đăng nhập:</span> {session?.user?.email}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Họ và tên:</span>{' '}
                {session?.user?.name || 'Chưa cập nhật'}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Vai trò:</span>{' '}
                <span className="font-bold text-cyan-800">{session?.user?.role || 'STAFF'}</span>
              </p>
            </div>
          </div>

          {/* Change Password */}
          <div className={PANEL + ' p-6'}>
            <h2 className="text-lg font-bold mb-4 text-slate-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-cyan-600" />
              Đổi mật khẩu tài khoản
            </h2>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mật khẩu hiện tại *
                </label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mật khẩu mới *
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={loading} className={PRIMARY_BTN}>
                  {loading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
