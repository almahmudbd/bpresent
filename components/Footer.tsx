import { BarChart3, Github, Twitter, Linkedin } from "lucide-react";
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
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
                        <ul className="space-y-2">
                            <li><Link href="#" className="text-sm text-gray-500 hover:text-indigo-600">Features</Link></li>
                            <li><Link href="#" className="text-sm text-gray-500 hover:text-indigo-600">Templates</Link></li>
                            <li><Link href="#" className="text-sm text-gray-500 hover:text-indigo-600">Pricing</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
                        <ul className="space-y-2">
                            <li><Link href="#" className="text-sm text-gray-500 hover:text-indigo-600">About</Link></li>
                            <li><Link href="#" className="text-sm text-gray-500 hover:text-indigo-600">Blog</Link></li>
                            <li><Link href="#" className="text-sm text-gray-500 hover:text-indigo-600">Careers</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Connect</h3>
                        <div className="flex gap-4">
                            <a href="#" className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <Github className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <Linkedin className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        © {new Date().getFullYear()} Present. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">Privacy Policy</Link>
                        <Link href="#" className="text-sm text-gray-500 hover:text-gray-900">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
