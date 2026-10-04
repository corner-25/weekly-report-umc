import type { Config } from "tailwindcss";

/** Thang xanh thương hiệu UMC, sáng hơn màu logo (#1b5fad) cho giao diện dùng cả ngày. */
const BRAND = {
  50: "#eff6fe",
  100: "#dbeafc",
  200: "#bdd8f8",
  300: "#90bdf2",
  400: "#5e9ee9",
  500: "#3d84e0",
  600: "#2d6fcd",
  700: "#285ba8",
  800: "#264d87",
  900: "#24426e",
  950: "#182a47",
};

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts}",
  ],
  safelist: [
    'text-emerald-600',
    'text-red-500',
    'text-gray-400',
    'bg-emerald-50',
    'bg-red-50',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Màu chính của app: xanh dương thương hiệu UMC (logo bệnh viện), tông sáng.
        // Đặt đè lên `cyan` để mọi chỗ đang dùng cyan-* đổi theo một lần —
        // dùng `brand-*` cho code mới.
        cyan: BRAND,
        brand: BRAND,
      },
      // Chuyển cảnh: ngắn (150–220ms), chỉ opacity/transform để mượt trên máy yếu.
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "page-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "sheet-up": { from: { transform: "translateY(24px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out both",
        "page-in": "page-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "pop-in": "pop-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "sheet-up": "sheet-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
