// Next.js gọi register() một lần khi server khởi động.
//
// Build sẵn embedding tên chỉ số cho chatbot ở nền, để câu hỏi đầu tiên sau
// mỗi lần deploy cũng có gợi ý chỉ số mà không phải chờ (~30s cho 2.500 chỉ số).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Không build lúc `next build` — khi đó chưa có kết nối DB chỉ-đọc.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { warmMetricEmbeddings } = await import('@/lib/chatbot/embeddings');
  warmMetricEmbeddings();
}
