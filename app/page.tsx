import Link from "next/link";
import { ArrowRight, BarChart3, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-gray-900">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Real-time <span className="text-indigo-600">Polling</span>
        </h1>
        <p className="text-lg text-gray-600">
          Engage your audience with instant feedback. Create polls, share the code, and watch results update live.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-10">
          <Link href="/join" className="group flex flex-col items-center p-6 bg-white rounded-xl shadow-sm border hover:border-indigo-500 hover:shadow-md transition-all">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
              <Users className="h-6 w-6 text-indigo-600 group-hover:text-white" />
            </div>
            <h2 className="text-xl font-semibold">Join a Vote</h2>
            <p className="text-sm text-gray-500 mt-2">Enter a code to vote</p>
            <div className="mt-4 flex items-center text-indigo-600 font-medium text-sm">
              Join now <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </Link>

          <Link href="/presenter" className="group flex flex-col items-center p-6 bg-white rounded-xl shadow-sm border hover:border-indigo-500 hover:shadow-md transition-all">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
              <BarChart3 className="h-6 w-6 text-indigo-600 group-hover:text-white" />
            </div>
            <h2 className="text-xl font-semibold">Presenter View</h2>
            <p className="text-sm text-gray-500 mt-2">Create and manage polls</p>
            <div className="mt-4 flex items-center text-indigo-600 font-medium text-sm">
              Go to Dashboard <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
