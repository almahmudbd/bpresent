"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, Trash2, ArrowRight, Save, LayoutTemplate, BarChart3, PieChart,
    MessageSquare, MessageCircleQuestion, Lightbulb, AlignLeft, Star,
    ArrowUpDown, ClipboardList, GripVertical, FolderPlus, X, ChevronDown, ChevronRight,
    ToggleLeft, ToggleRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { type SlideType, type SlideStyle } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Local state interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface SlideState {
    id: string;
    question: string;
    type: SlideType;
    options: string[];
    style?: SlideStyle;
    groupId?: string; // references SlideGroupState.id
}

interface SlideGroupState {
    id: string;    // client-side temp id
    title: string;
    type: "survey";
    collapsed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide type definitions for the picker
// ─────────────────────────────────────────────────────────────────────────────

const SLIDE_TYPES: { type: SlideType; label: string; icon: React.ReactNode; description: string }[] = [
    { type: "quiz",       label: "Multiple Choice", icon: <BarChart3 size={18} />,        description: "Predefined options, bar/pie/donut chart" },
    { type: "word-cloud", label: "Word Cloud",      icon: <MessageSquare size={18} />,    description: "Free text, visualized as a word cloud" },
    { type: "open-text",  label: "Open Text",       icon: <AlignLeft size={18} />,        description: "Free text answers collected as a list" },
    { type: "ideas",      label: "Ideas",           icon: <Lightbulb size={18} />,        description: "Participants submit & upvote ideas" },
    { type: "ranking",    label: "Ranking",         icon: <ArrowUpDown size={18} />,      description: "Drag-and-drop to rank a list of items" },
    { type: "rating",     label: "Rating",          icon: <Star size={18} />,             description: "Star rating (1–5) or numeric scale (1–10)" },
    { type: "survey",     label: "Survey",          icon: <ClipboardList size={18} />,    description: "Group of questions presented together" },
];

const OPTIONS_TYPES: SlideType[] = ["quiz", "ranking"];
const NO_OPTIONS_TYPES: SlideType[] = ["word-cloud", "open-text", "ideas"];

function defaultOptions(type: SlideType): string[] {
    if (OPTIONS_TYPES.includes(type)) return ["", ""];
    return [];
}

function defaultStyle(type: SlideType): SlideStyle | undefined {
    const map: Partial<Record<SlideType, SlideStyle>> = {
        "quiz": "donut", "word-cloud": "cloud", "open-text": "list",
        "ideas": "list", "ranking": "horizontal-bar", "rating": "stars", "survey": "list",
    };
    return map[type];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PresenterDashboard() {
    const router = useRouter();
    const [slides, setSlides] = useState<SlideState[]>([
        { id: crypto.randomUUID(), question: "", type: "quiz", options: ["", ""], style: "donut" },
    ]);
    const [groups, setGroups] = useState<SlideGroupState[]>([]);
    const [qaEnabled, setQaEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [savedPresentationId, setSavedPresentationId] = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveTitle, setSaveTitle] = useState("");
    const [showTypePicker, setShowTypePicker] = useState<number | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const loadData = sessionStorage.getItem("loadPresentation");
        if (loadData) {
            try {
                const presentation = JSON.parse(loadData);
                setSavedPresentationId(presentation.id);
                setSaveTitle(presentation.title);
                setSlides(presentation.slides.map((s: any) => ({
                    ...s,
                    id: crypto.randomUUID(),
                    options: s.options || defaultOptions(s.type),
                    style: s.style,
                })));
                sessionStorage.removeItem("loadPresentation");
            } catch (error) {
                console.error("Error loading presentation:", error);
            }
        }
    }, []);

    // Auto-save
    const { isSaving, lastSaved, error: saveError } = useAutoSave(
        { title: saveTitle, slides },
        async (data) => {
            if (!user || !saveTitle || !savedPresentationId) return;
            await fetch(`/api/presentations/${savedPresentationId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                    title: data.title,
                    slides: data.slides.map((s) => ({
                        type: s.type,
                        question: s.question,
                        options: OPTIONS_TYPES.includes(s.type) ? s.options : undefined,
                        style: s.style,
                    })),
                }),
            });
        },
        { interval: 30000, enabled: !!user && !!savedPresentationId }
    );

    // ── Slide mutations ──

    const updateSlide = <K extends keyof SlideState>(index: number, field: K, value: SlideState[K]) => {
        const newSlides = [...slides];
        newSlides[index][field] = value;
        setSlides(newSlides);
    };

    const changeSlideType = (index: number, newType: SlideType) => {
        const newSlides = [...slides];
        newSlides[index].type = newType;
        newSlides[index].options = defaultOptions(newType);
        newSlides[index].style = defaultStyle(newType);
        if (newType !== "survey") newSlides[index].groupId = undefined;
        setSlides(newSlides);
        setShowTypePicker(null);
    };

    const addSlide = (groupId?: string) => {
        const newSlide: SlideState = {
            id: crypto.randomUUID(),
            question: "",
            type: groupId ? "survey" : "quiz",
            options: groupId ? [] : ["", ""],
            style: groupId ? "list" : "donut",
            groupId,
        };
        if (groupId) {
            // Insert after last slide of this group
            const lastGroupIdx = slides.reduce((last, s, i) => s.groupId === groupId ? i : last, -1);
            const newSlides = [...slides];
            newSlides.splice(lastGroupIdx + 1, 0, newSlide);
            setSlides(newSlides);
        } else {
            setSlides([...slides, newSlide]);
        }
    };

    const removeSlide = (index: number) => {
        if (slides.length > 1) setSlides(slides.filter((_, i) => i !== index));
    };

    const updateOption = (slideIndex: number, optionIndex: number, value: string) => {
        const newSlides = [...slides];
        newSlides[slideIndex].options[optionIndex] = value;
        setSlides(newSlides);
    };

    const addOption = (slideIndex: number) => {
        const newSlides = [...slides];
        newSlides[slideIndex].options.push("");
        setSlides(newSlides);
    };

    const removeOption = (slideIndex: number, optionIndex: number) => {
        const newSlides = [...slides];
        if (newSlides[slideIndex].options.length > 2) {
            newSlides[slideIndex].options.splice(optionIndex, 1);
            setSlides(newSlides);
        }
    };

    // ── Survey group mutations ──

    const addSurveyGroup = () => {
        const newGroupId = crypto.randomUUID();
        const newGroup: SlideGroupState = {
            id: newGroupId,
            title: "New Survey",
            type: "survey",
            collapsed: false,
        };
        setGroups((prev) => [...prev, newGroup]);
        setSlides((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                question: "",
                type: "survey",
                options: [],
                style: "list",
                groupId: newGroupId,
            },
        ]);
    };

    const updateGroup = (id: string, field: keyof SlideGroupState, value: any) => {
        setGroups(groups.map((g) => g.id === id ? { ...g, [field]: value } : g));
    };

    const removeGroup = (id: string) => {
        setGroups(groups.filter((g) => g.id !== id));
        setSlides(slides.filter((s) => s.groupId !== id));
    };

    // ── Save presentation ──

    const handleSavePresentation = async () => {
        if (!user) { alert("Please sign in to save presentations"); return; }
        if (!saveTitle.trim()) { alert("Please enter a title"); return; }
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const presentationData = {
                title: saveTitle,
                slides: slides.map((s) => ({
                    type: s.type, question: s.question,
                    options: OPTIONS_TYPES.includes(s.type) ? s.options : undefined,
                    style: s.style, groupId: s.groupId,
                })),
            };
            if (savedPresentationId) {
                await fetch(`/api/presentations/${savedPresentationId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
                    body: JSON.stringify(presentationData),
                });
            } else {
                const response = await fetch("/api/presentations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
                    body: JSON.stringify(presentationData),
                });
                const data = await response.json();
                setSavedPresentationId(data.presentation?.id);
            }
            setShowSaveModal(false);
        } catch (error) {
            console.error("Error saving:", error);
            alert("Failed to save presentation");
        }
    };

    // ── Create poll & go live ──

    const createPoll = async () => {
        if (slides.some((s) => !s.question.trim())) return;
        if (slides.some((s) => OPTIONS_TYPES.includes(s.type) && s.options.some((o) => !o.trim()))) return;

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

            const response = await fetch("/api/poll", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    title: saveTitle?.trim() || slides[0].question,
                    slides: slides.map((s) => ({
                        type: s.type,
                        question: s.question,
                        options: OPTIONS_TYPES.includes(s.type) ? s.options : undefined,
                        style: s.style,
                        group_id: s.groupId,
                    })),
                    groups: groups.map((g, idx) => ({
                        tempId: g.id,
                        title: g.title,
                        type: g.type,
                        order_index: idx,
                    })),
                    qa_enabled: qaEnabled,
                }),
            });

            const data = await response.json();
            if (data.success) {
                router.push(`/presenter/live/${data.code}`);
            } else {
                alert("Failed to create poll: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Failed to create poll", error);
            alert("Failed to create poll");
        } finally {
            setLoading(false);
        }
    };

    // ── Render helpers ──

    const standaloneSlides = slides.filter((s) => !s.groupId);
    const isValid = slides.every((s) => s.question.trim()) &&
        slides.every((s) => !OPTIONS_TYPES.includes(s.type) || s.options.every((o) => o.trim()));

    return (
        <div className="presenter-builder-page">
            <div className="presenter-builder-container">
                {/* Header */}
                <div className="builder-header">
                    <h1>Create Your Poll</h1>
                    <div className="builder-header-actions">
                        {user && savedPresentationId && (
                            <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} error={saveError} />
                        )}
                        {user && (
                            <button className="btn-save" onClick={() => setShowSaveModal(true)}>
                                <Save size={16} />
                                {savedPresentationId ? "Save As..." : "Save"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="builder-body">
                    {/* Q&A Toggle */}
                    <div className="builder-qa-toggle">
                        <div className="qa-toggle-info">
                            <MessageCircleQuestion size={18} />
                            <div>
                                <strong>Audience Q&amp;A</strong>
                                <p>Allow participants to ask questions during the session</p>
                            </div>
                        </div>
                        <button
                            className={`qa-toggle-btn ${qaEnabled ? "qa-toggle-on" : "qa-toggle-off"}`}
                            onClick={() => setQaEnabled(!qaEnabled)}
                            aria-pressed={qaEnabled}
                        >
                            {qaEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                            <span>{qaEnabled ? "Enabled" : "Disabled"}</span>
                        </button>
                    </div>

                    {/* Standalone slides */}
                    {standaloneSlides.map((slide) => {
                        const sIndex = slides.indexOf(slide);
                        return (
                            <SlideCard
                                key={slide.id}
                                slide={slide}
                                sIndex={sIndex}
                                showTypePicker={showTypePicker === sIndex}
                                onToggleTypePicker={(open) => setShowTypePicker(open ? sIndex : null)}
                                onChangeType={(type) => changeSlideType(sIndex, type)}
                                onUpdateSlide={(field, value) => updateSlide(sIndex, field, value)}
                                onRemove={() => removeSlide(sIndex)}
                                onUpdateOption={(oIdx, val) => updateOption(sIndex, oIdx, val)}
                                onAddOption={() => addOption(sIndex)}
                                onRemoveOption={(oIdx) => removeOption(sIndex, oIdx)}
                                canRemove={slides.length > 1}
                            />
                        );
                    })}

                    {/* Survey groups */}
                    {groups.map((group) => {
                        const groupSlides = slides.filter((s) => s.groupId === group.id);
                        return (
                            <div key={group.id} className="survey-group-card">
                                <div className="survey-group-header">
                                    <div className="survey-group-title-row">
                                        <ClipboardList size={18} className="survey-icon" />
                                        <input
                                            type="text"
                                            className="survey-group-title-input"
                                            value={group.title}
                                            onChange={(e) => updateGroup(group.id, "title", e.target.value)}
                                            placeholder="Survey title..."
                                        />
                                        <span className="survey-group-badge">Survey · {groupSlides.length} questions</span>
                                    </div>
                                    <div className="survey-group-actions">
                                        <button type="button" onClick={() => updateGroup(group.id, "collapsed", !group.collapsed)}>
                                            {group.collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        <button type="button" className="btn-remove-group" onClick={() => removeGroup(group.id)}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                {!group.collapsed && (
                                    <div className="survey-group-slides">
                                        {groupSlides.map((slide) => {
                                            const sIndex = slides.indexOf(slide);
                                            return (
                                                <SurveySlideCard
                                                    key={slide.id}
                                                    slide={slide}
                                                    sIndex={sIndex}
                                                    groupSlideIndex={groupSlides.indexOf(slide)}
                                                    onUpdateSlide={(field, value) => updateSlide(sIndex, field, value)}
                                                    onRemove={() => removeSlide(sIndex)}
                                                    canRemove={groupSlides.length > 1}
                                                />
                                            );
                                        })}
                                        <button
                                            type="button"
                                            className="btn-add-survey-question"
                                            onClick={() => addSlide(group.id)}
                                        >
                                            <Plus size={15} /> Add question to survey
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add slide / survey group buttons */}
                    <div className="builder-add-actions">
                        <button type="button" className="btn-add-slide" onClick={() => addSlide()}>
                            <Plus size={18} /> Add Slide
                        </button>
                        <button type="button" className="btn-add-survey-group" onClick={addSurveyGroup}>
                            <FolderPlus size={18} /> Add Survey Group
                        </button>
                    </div>

                    {/* Go Live button */}
                    <button
                        className="btn-go-live"
                        onClick={createPoll}
                        disabled={loading || !isValid}
                    >
                        {loading ? "Creating..." : (<>Start Presenting <ArrowRight size={18} /></>)}
                    </button>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="modal-backdrop" onClick={() => setShowSaveModal(false)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <h3>Save Presentation</h3>
                        <input
                            type="text"
                            value={saveTitle}
                            onChange={(e) => setSaveTitle(e.target.value)}
                            className="modal-input"
                            placeholder="Enter presentation title..."
                        />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowSaveModal(false)}>Cancel</button>
                            <button className="btn-save-confirm" onClick={handleSavePresentation}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: SlideCard (standalone slide)
// ─────────────────────────────────────────────────────────────────────────────

function SlideCard({
    slide, sIndex, showTypePicker, onToggleTypePicker, onChangeType,
    onUpdateSlide, onRemove, onUpdateOption, onAddOption, onRemoveOption, canRemove,
}: {
    slide: SlideState; sIndex: number; showTypePicker: boolean;
    onToggleTypePicker: (open: boolean) => void;
    onChangeType: (type: SlideType) => void;
    onUpdateSlide: <K extends keyof SlideState>(field: K, value: SlideState[K]) => void;
    onRemove: () => void;
    onUpdateOption: (oIdx: number, val: string) => void;
    onAddOption: () => void;
    onRemoveOption: (oIdx: number) => void;
    canRemove: boolean;
}) {
    const currentTypeDef = SLIDE_TYPES.find((t) => t.type === slide.type);

    return (
        <div className="slide-card">
            {/* Slide header */}
            <div className="slide-card-header">
                <span className="slide-number">Slide {sIndex + 1}</span>
                <div className="slide-header-actions">
                    {/* Type picker button */}
                    <button
                        className="btn-type-picker"
                        onClick={() => onToggleTypePicker(!showTypePicker)}
                    >
                        {currentTypeDef?.icon}
                        <span>{currentTypeDef?.label}</span>
                        <ChevronDown size={14} />
                    </button>
                    {canRemove && (
                        <button className="btn-remove-slide" onClick={onRemove}>
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Type picker dropdown */}
            {showTypePicker && (
                <div className="type-picker-dropdown">
                    {SLIDE_TYPES.filter((t) => t.type !== "survey").map((typeDef) => (
                        <button
                            key={typeDef.type}
                            className={`type-picker-option ${slide.type === typeDef.type ? "selected" : ""}`}
                            onClick={() => onChangeType(typeDef.type)}
                        >
                            <span className="type-picker-icon">{typeDef.icon}</span>
                            <div className="type-picker-info">
                                <strong>{typeDef.label}</strong>
                                <span>{typeDef.description}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Question input */}
            <div className="slide-field">
                <label>Question</label>
                <input
                    type="text"
                    value={slide.question}
                    onChange={(e) => onUpdateSlide("question", e.target.value)}
                    className="slide-question-input"
                    placeholder="What would you like to ask?"
                />
            </div>

            {/* Style selector */}
            <StyleSelector slide={slide} onUpdateSlide={onUpdateSlide} />

            {/* Options editor (quiz / ranking) */}
            {OPTIONS_TYPES.includes(slide.type) && (
                <div className="slide-field">
                    <label>{slide.type === "ranking" ? "Items to rank" : "Options"}</label>
                    <div className="options-list">
                        {slide.options.map((opt, oIdx) => (
                            <div key={oIdx} className="option-row">
                                {slide.type === "ranking" && <GripVertical size={16} className="option-drag-handle" />}
                                <span className="option-letter">{String.fromCharCode(65 + oIdx)}</span>
                                <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => onUpdateOption(oIdx, e.target.value)}
                                    className="option-input"
                                    placeholder={slide.type === "ranking" ? `Item ${oIdx + 1}` : `Option ${oIdx + 1}`}
                                />
                                {slide.options.length > 2 && (
                                    <button className="btn-remove-option" onClick={() => onRemoveOption(oIdx)}>
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button className="btn-add-option" onClick={onAddOption}>
                        <Plus size={14} /> Add {slide.type === "ranking" ? "item" : "option"}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: SurveySlideCard (inside a survey group)
// ─────────────────────────────────────────────────────────────────────────────

function SurveySlideCard({
    slide, sIndex, groupSlideIndex, onUpdateSlide, onRemove, canRemove,
}: {
    slide: SlideState; sIndex: number; groupSlideIndex: number;
    onUpdateSlide: <K extends keyof SlideState>(field: K, value: SlideState[K]) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    return (
        <div className="survey-slide-card">
            <div className="survey-slide-header">
                <span className="survey-slide-num">Q{groupSlideIndex + 1}</span>
                {canRemove && (
                    <button className="btn-remove-slide" onClick={onRemove}>
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
            <input
                type="text"
                value={slide.question}
                onChange={(e) => onUpdateSlide("question", e.target.value)}
                className="slide-question-input"
                placeholder="Survey question..."
            />
            {/* Survey sub-questions only support open-text and rating for now */}
            <div className="survey-type-row">
                <label>Type:</label>
                <div className="survey-type-btns">
                    {["open-text", "rating"].map((t) => (
                        <button
                            key={t}
                            className={`survey-type-btn ${slide.type === t ? "selected" : ""}`}
                            onClick={() => onUpdateSlide("type", t as SlideType)}
                        >
                            {t === "open-text" ? <AlignLeft size={14} /> : <Star size={14} />}
                            {t === "open-text" ? "Open Text" : "Rating"}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: StyleSelector
// ─────────────────────────────────────────────────────────────────────────────

function StyleSelector({
    slide,
    onUpdateSlide,
}: {
    slide: SlideState;
    onUpdateSlide: <K extends keyof SlideState>(field: K, value: SlideState[K]) => void;
}) {
    type StyleOption = { value: SlideStyle; label: string; icon: React.ReactNode };

    const styleOptions: StyleOption[] = (() => {
        switch (slide.type) {
            case "quiz": return [
                { value: "donut", label: "Bars",    icon: <LayoutTemplate size={16} /> },
                { value: "bar",   label: "Chart",   icon: <BarChart3 size={16} /> },
                { value: "pie",   label: "Pie",     icon: <PieChart size={16} /> },
            ];
            case "word-cloud": return [
                { value: "cloud",  label: "Cloud",  icon: <MessageSquare size={16} /> },
                { value: "bubble", label: "Bubble", icon: <LayoutTemplate size={16} /> },
            ];
            case "rating": return [
                { value: "stars", label: "Stars (1–5)",  icon: <Star size={16} /> },
                { value: "scale", label: "Scale (1–10)", icon: <BarChart3 size={16} /> },
            ];
            default: return [];
        }
    })();

    if (styleOptions.length === 0) return null;

    return (
        <div className="slide-field">
            <label>Visualization Style</label>
            <div className="style-selector-row">
                {styleOptions.map((opt) => (
                    <button
                        key={opt.value}
                        className={`style-btn ${slide.style === opt.value ? "selected" : ""}`}
                        onClick={() => onUpdateSlide("style", opt.value)}
                        title={opt.label}
                    >
                        {opt.icon}
                        <span>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
