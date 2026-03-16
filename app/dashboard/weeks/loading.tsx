export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex justify-between items-center">
        <div className="h-8 w-64 bg-gray-200 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4">
          <div className="flex-1 h-10 bg-gray-200 rounded-md" />
          <div className="w-32 h-10 bg-gray-200 rounded-md" />
          <div className="w-24 h-10 bg-gray-200 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 space-y-3">
            <div className="flex justify-between">
              <div className="h-6 w-20 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="flex-1 h-8 bg-gray-100 rounded-md" />
              <div className="flex-1 h-8 bg-gray-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
