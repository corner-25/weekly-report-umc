export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex justify-between items-center">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-gray-200 rounded-lg" />
      </div>
      <div className="mb-6 bg-white p-4 rounded-lg shadow flex gap-4">
        <div className="flex-1 h-10 bg-gray-200 rounded-md" />
        <div className="w-40 h-10 bg-gray-200 rounded-md" />
        <div className="w-36 h-10 bg-gray-200 rounded-md" />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-3 w-28 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="h-8 w-16 bg-gray-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
