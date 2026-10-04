'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, ClipboardList, Eye, EyeOff, HeartHandshake, Loader2, Lock, Mail, FileText } from 'lucide-react';

const MODULES = [
  { icon: FileText, title: 'Báo cáo tuần', text: 'Tổng hợp báo cáo 14 phòng, số liệu tự trích bằng AI' },
  { icon: ClipboardList, title: 'Quản lý công việc', text: 'Theo dõi chỉ đạo của Ban Giám đốc, nhắc việc thư ký' },
  { icon: HeartHandshake, title: 'CRM đối tác', text: 'Dẫn khách VIP, đón đoàn, dịp quan trọng của đối tác' },
];

const INPUT =
  'block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:bg-slate-50';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Chỉ nhận đường dẫn nội bộ ("/nhap-nhanh?loai=doan"), không cho chuyển sang trang ngoài.
  const callbackUrl = searchParams.get('callbackUrl');
  const target = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/dashboard';
  const fromQuickEntry = target.startsWith('/nhap-nhanh');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        // Nếu remember=true → dùng maxAge 30 ngày, ngược lại session cookie (đóng tab là hết)
        ...(remember ? {} : { maxAge: 0 }),
      });

      if (result?.error) {
        setError('Email hoặc mật khẩu không đúng. Kiểm tra lại chữ hoa, chữ thường và bộ gõ tiếng Việt.');
        setLoading(false);
      } else {
        // Giữ trạng thái "đang đăng nhập" tới khi trang mới mở, tránh bấm hai lần.
        router.push(target);
        router.refresh();
      }
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-50">
      {/* Cột giới thiệu — ẩn trên điện thoại để form lên ngay màn hình đầu */}
      <section
        aria-label="Giới thiệu hệ thống"
        className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-cyan-600 via-sky-700 to-blue-800 p-10 text-white lg:flex xl:p-14"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg shadow-blue-950/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ngang.png" alt="Bệnh viện Đại học Y Dược TP.HCM" width={3701} height={833} className="h-10 w-auto" />
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">Phòng Hành chính</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-balance xl:text-[2.75rem]">
              Hệ thống điều hành công việc hành chính
            </h1>
            <p className="mt-4 max-w-md text-base text-cyan-50/90">
              Một nơi để theo dõi báo cáo, chỉ đạo và đối tác của bệnh viện.
            </p>
          </div>
          <ul className="space-y-3">
            {MODULES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-cyan-50/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-cyan-100/70">Bệnh viện Đại học Y Dược Thành phố Hồ Chí Minh</p>
      </section>

      {/* Form đăng nhập */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ngang.png" alt="Bệnh viện Đại học Y Dược TP.HCM" width={3701} height={833} className="h-10 w-auto" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Phòng Hành chính</p>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Đăng nhập</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {fromQuickEntry ? 'Đăng nhập để mở form nhập nhanh vừa quét.' : 'Dùng email và mật khẩu được cấp để vào hệ thống.'}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div role="alert" data-testid="signin-error" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoFocus
                  required
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  className={INPUT}
                  placeholder="ten@umc.edu.vn"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Mật khẩu</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  className={`${INPUT} pr-11`}
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label htmlFor="remember" className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-slate-600">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>
                Ghi nhớ đăng nhập 30 ngày
                <span className="block text-xs text-slate-400">Bỏ chọn nếu dùng máy tính chung</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-cyan-500/25 transition hover:from-cyan-600 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
            Chưa có tài khoản?{' '}
            <Link href="/auth/signup" className="font-semibold text-cyan-700 hover:text-cyan-800 hover:underline">
              Đăng ký
            </Link>
            <span className="mt-1 block text-xs text-slate-400">Quên mật khẩu, liên hệ quản trị viên Phòng Hành chính để cấp lại.</span>
          </p>
        </div>
      </section>
    </main>
  );
}

/** useSearchParams cần Suspense để trang vẫn dựng sẵn được. */
export default function SignIn() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
