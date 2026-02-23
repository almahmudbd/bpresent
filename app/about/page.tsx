import { Github, Facebook, Globe, ExternalLink, Info, Link as LinkIcon } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
                        About <span className="text-indigo-600">slide.pp.ua</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Real-time interactive presentations for modern classrooms.
                    </p>
                </div>

                {/* Project Details */}
                <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Info className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900">Project Mission</h2>
                        <p className="text-gray-600 leading-relaxed">
                            slide.pp.ua is designed to enhance classroom engagement through real-time feedback. Teachers and presenters can create instant polls, word clouds, and interactive slides, while students participate anonymously using any device. Our goal is to make every presentation a two-way conversation.
                        </p>
                    </div>
                </section>

                {/* Domain Links */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 text-center">Available Domains</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <a
                            href="https://slide.pp.ua/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-500 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <LinkIcon className="w-6 h-6 text-indigo-600" />
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900">slide.pp.ua</h3>
                            <p className="text-sm text-gray-500">Primary Domain</p>
                        </a>
                        <a
                            href="https://bpresent.pp.ua/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-500 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <LinkIcon className="w-6 h-6 text-indigo-600" />
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900">bpresent.pp.ua</h3>
                            <p className="text-sm text-gray-500">Alternative Domain</p>
                        </a>
                        <a
                            href="https://bpresent.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-6 bg-indigo-600 rounded-2xl border border-indigo-500 shadow-sm hover:bg-indigo-700 transition-all group text-white"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <LinkIcon className="w-6 h-6 text-white" />
                                <ExternalLink className="w-4 h-4 text-indigo-200 group-hover:text-white" />
                            </div>
                            <h3 className="font-semibold">bpresent.vercel.app</h3>
                            <p className="text-sm text-indigo-100">Main/Production Domain</p>
                        </a>
                    </div>
                </section>

                {/* Developer Links */}
                <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Connect with Me</h2>
                    <div className="flex justify-center gap-8">
                        <a href="https://github.com/almahmudbd/present" className="flex flex-col items-center gap-2 group" target="_blank" rel="noopener noreferrer">
                            <div className="p-4 bg-gray-50 rounded-full group-hover:bg-indigo-50 transition-colors">
                                <Github className="w-6 h-6 text-gray-700 group-hover:text-indigo-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-600">GitHub</span>
                        </a>
                        <a href="https://thealmahmud.blogspot.com/" className="flex flex-col items-center gap-2 group" target="_blank" rel="noopener noreferrer">
                            <div className="p-4 bg-gray-50 rounded-full group-hover:bg-indigo-50 transition-colors">
                                <Globe className="w-6 h-6 text-gray-700 group-hover:text-indigo-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-600">Portfolio</span>
                        </a>
                        <a href="mailto:wapmahmud@duck.com" className="flex flex-col items-center gap-2 group">
                            <div className="p-4 bg-gray-50 rounded-full group-hover:bg-red-50 transition-colors">
                                <Info className="w-6 h-6 text-gray-700 group-hover:text-red-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-600 group-hover:text-red-600">Report Problem</span>
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
}
