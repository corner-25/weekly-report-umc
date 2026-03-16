export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-56 bg-gray-200 rounded-lg mb-2" />
          <div className="h-4 w-40 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
            <div className="h-7 w-12 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="bg-gray-200 rounded-xl h-40" />
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-32" />
        </div>
      </div>
    </div>
  );
}
