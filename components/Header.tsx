import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function Header() {
    return (
        <header className="w-full bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="p-2 bg-indigo-600 rounded-lg group-hover:bg-indigo-700 transition-colors">
                        <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Present
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                    <Link href="/features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        Features
                    </Link>
                    <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        Pricing
                    </Link>
                    <Link href="/about" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        About
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <Link
                        href="/login"
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/"
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
                    >
                        Get Started
                    </Link>
                </div>
            </div>
        </header>
    );
}
