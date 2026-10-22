/** Shared by the FAQ page and the landing page FAQ section. */
export const FAQS = [
  { q: "Is B.Tech Hub free?", a: "Yes. All calculators, resources and AI features are free for students." },
  { q: "How is SGPA calculated?", a: "Each subject's marks are converted to an AKTU grade point (A+ = 10 down to F = 0). SGPA = Σ(grade point × credits) / Σ credits." },
  { q: "How is CGPA converted to percentage?", a: "We use the AKTU formula: percentage = (CGPA − 0.75) × 10." },
  { q: "What is Vac?", a: "Vac is a LangChain AI agent powered by Gemini. It can call 12 tools, like calculating SGPA, finding PYQs, searching the syllabus and making study plans." },
  { q: "Where do 'Ask your Syllabus' answers come from?", a: "From official syllabus PDFs and notes indexed in Pinecone. Every answer shows numbered sources so you can verify it." },
  { q: "Why do some resources say 'Coming soon'?", a: "Those slots exist but the link has not been uploaded yet. Admins fill them from the admin panel." },
  { q: "Why should I log in?", a: "Login (Google only) lets you save SGPAs, track quiz scores and weak topics, keep study plans and bookmark resources." },
  { q: "Is my data safe?", a: "We only store your Google name, email and photo plus what you save. Sessions use signed httpOnly JWT cookies. We never see your Google password." },
];
