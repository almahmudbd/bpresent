import { BarChart3, Github, Facebook, Blogger } from "lucide-react";
import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-600 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-gray-900">Present</span>
                        </Link>
                        <p className="text-sm text-gray-500 max-w-xs">
                            Real-time interactive presentations for modern classrooms and meetings.
                        </p>
                        <p className="text-sm text-gray-500">
                            © {new Date().getFullYear()} bPresent. All rights reserved.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Connect</h3>
                        <div className="flex gap-4">
                            <a href="https://github.com/almahmudbd/present" className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <Github className="w-5 h-5" />
                            </a>
                            <a href="https://www.facebook.com/almahmud1234" className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <Facebook className="w-5 h-5" />
                            </a>
                            <a href="https://thealmahmud.blogspot.com/" className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <Blogger className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
