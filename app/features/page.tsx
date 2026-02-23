import { Zap, Globe, Shield, Users, BarChart3, Presentation, Send, CheckCircle2, AlertCircle, LayoutList, Layers, MessageSquare, Monitor } from "lucide-react";

export default function FeaturesPage() {
    const mainFeatures = [
        {
            title: "Real-time Interaction",
            details: [
                "Instant Polling: Create and launch polls in milliseconds.",
                "Word Clouds: Watch audience ideas grow into dynamic visual clouds.",
                "Live Updates: Results calculation and rendering happen instantly without page refreshes.",
                "Active Participation: Two-way communication channel between presenter and audience."
            ],
            icon: Zap,
            color: "text-amber-500",
            bg: "bg-amber-50"
        },
        {
            title: "Audience Experience",
            details: [
                "Zero Installation: No apps or extensions required for participants.",
                "4-Digit Code: Joining takes 2 seconds—just enter the code and vote.",
                "Device Harmony: Works flawlessly on mobile, tablet, and desktop browsers.",
                "Total Anonymity: Participants can express honest opinions without identity exposure."
            ],
            icon: Users,
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
        {
            title: "Presenter Control",
            details: [
                "Dashboard Management: Create, edit, and organize multiple presentations.",
                "Result Customization: Choose from different visualization types (Bar, Pie, WordCloud).",
                "Presenter View: Separate control interface to manage slides while showing results.",
                "Shareable Links: Copy direct links to specific slides for quick access."
            ],
            icon: Monitor,
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        }
    ];

    const limitations = [
        "Poll Expiration: Anonymous polls expire in 3 hours, while registered user polls remain active for 24 hours.",
        "Network Dependency: Requires a stable internet connection for real-time synchronization.",
        "Browser Support: Optimized for modern browsers; legacy versions may experience UI inconsistencies.",
        "Static Content: Focused on polling and feedback rather than complex multimedia slide decks."
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-16">
                {/* Header */}
                {/* How it Works Section */}
                <section className="bg-indigo-600 rounded-3xl p-8 md:p-12 shadow-xl text-white mb-16">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">How it Works</h2>
                        <p className="text-indigo-100 italic">"Simplicity is the ultimate sophistication."</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {[
                            { step: "01", title: "Create", desc: "Start a new slide or word cloud from your dashboard." },
                            { step: "02", title: "Present", desc: "Open the presentation view on your projector/screen." },
                            { step: "03", title: "Vote", desc: "Audience joins via code and votes in real-time." },
                            { step: "04", title: "Review", desc: "Download results or share summaries with participants." }
                        ].map((item, index) => (
                            <div key={index} className="relative p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                                <span className="text-4xl font-black text-white/20 absolute top-4 right-4">{item.step}</span>
                                <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                                <p className="text-indigo-100 text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
                        Detailed <span className="text-indigo-600">Features</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Explore the full capabilities of slide.pp.ua and how it transforms your presentations.
                    </p>
                </div>

                {/* Features List Layout */}
                <div className="space-y-12">
                    {mainFeatures.map((feature, index) => (
                        <div key={index} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-start hover:shadow-md transition-shadow">
                            <div className={`w-16 h-16 ${feature.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                                <feature.icon className={`w-8 h-8 ${feature.color}`} />
                            </div>
                            <div className="flex-1 space-y-4">
                                <h3 className="text-2xl font-bold text-gray-900">{feature.title}</h3>
                                <ul className="space-y-3">
                                    {feature.details.map((detail, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-gray-600">
                                            <div className="mt-1.5 w-1.5 h-1.5 bg-indigo-600 rounded-full flex-shrink-0" />
                                            <span className="text-lg leading-relaxed">{detail}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Limitations Section */}
                <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-red-50">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Current Limitations</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {limitations.map((limit, index) => (
                            <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <CheckCircle2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                <p className="text-gray-600 text-sm leading-relaxed">{limit}</p>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}
