import { BarChart3, Github, Facebook, Globe } from "lucide-react";
import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-[#eeeadf] border-t border-[#dcd5c7]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-base text-[#263846]"> © sukkarshop.com {new Date().getFullYear()}</span>
                    </div>

                    <p className="text-xs text-[#68737a] text-center">
                        Real-time interactive presentations for modern classrooms
                    </p>

                    <div className="flex items-center gap-6">
                        <div className="flex gap-3">
                            <a href="https://github.com/almahmudbd/present" className="text-[#68737a] hover:text-[#173d59] transition-colors" aria-label="GitHub">
                                <Github className="w-4 h-4" />
                            </a>
                            <a href="https://thealmahmud.blogspot.com/" className="text-[#68737a] hover:text-[#173d59] transition-colors" aria-label="Blog">
                                <Globe className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
