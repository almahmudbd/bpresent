import { BarChart3, Github, Facebook, Globe } from "lucide-react";
import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-base text-gray-900"> © slide.pp.ua {new Date().getFullYear()}</span>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                        Real-time interactive presentations for modern classrooms
                    </p>

                    <div className="flex gap-3">
                        <a href="https://github.com/almahmudbd/present" className="text-gray-400 hover:text-indigo-600 transition-colors" aria-label="GitHub">
                            <Github className="w-4 h-4" />
                        </a>
                        <a href="https://thealmahmud.blogspot.com/" className="text-gray-400 hover:text-indigo-600 transition-colors" aria-label="Blog">
                            <Globe className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
