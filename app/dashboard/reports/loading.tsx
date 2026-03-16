export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-56 bg-gray-200 rounded-lg mb-2" />
        <div className="h-4 w-80 bg-gray-100 rounded" />
      </div>
      <div className="mb-6 bg-white p-4 rounded-lg shadow flex gap-4">
        <div className="w-24 h-10 bg-gray-200 rounded-md" />
        <div className="w-40 h-10 bg-gray-200 rounded-md" />
        <div className="w-40 h-10 bg-gray-200 rounded-md" />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-48 h-8 bg-gray-200 rounded" />
              <div className="w-12 h-8 bg-gray-100 rounded" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="w-20 h-8 bg-gray-100 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
