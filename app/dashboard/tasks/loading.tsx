export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex justify-between items-center">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="mb-6 bg-white p-4 rounded-lg shadow flex gap-4">
        <div className="w-40 h-10 bg-gray-200 rounded-md" />
        <div className="flex-1 h-10 bg-gray-200 rounded-md" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-5 w-64 bg-gray-200 rounded" />
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
            </div>
            <div className="h-3 w-40 bg-gray-100 rounded" />
            <div className="h-2 bg-gray-100 rounded-full w-full">
              <div className="h-2 bg-gray-200 rounded-full w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
