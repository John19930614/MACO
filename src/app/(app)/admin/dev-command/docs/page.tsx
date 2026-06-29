import { Card, CardHeader } from "@/components/ui/primitives";
import { BookOpen, Shield, Users, ClipboardList, CheckSquare, Star, HelpCircle, Rocket, Database, Wrench } from "lucide-react";

const GUIDES = [
  {
    title: "Admin User Guide",
    description: "How to create tasks, read agent outputs, approve changes, and release. Start here.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/admin-user-guide.md",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    audience: "All admins",
  },
  {
    title: "Agent Role Guide",
    description: "What each of the 19 AI agents does, when they are active, and what permissions they have.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/agent-role-guide.md",
    icon: Users,
    color: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    audience: "All admins",
  },
  {
    title: "Task Intake Guide",
    description: "How to write a good task description so the AI team produces better results, faster.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/task-intake-guide.md",
    icon: ClipboardList,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    audience: "All admins",
  },
  {
    title: "Approval Center Guide",
    description: "How approvals work, what each type means, and how to make good approval decisions.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/approval-center-guide.md",
    icon: CheckSquare,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    audience: "All admins",
  },
  {
    title: "Security Rules Guide",
    description: "The 7 always-blocked actions, the 10 security checks, and what to do when a critical finding appears.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/security-rules-guide.md",
    icon: Shield,
    color: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    audience: "All admins",
  },
  {
    title: "Experience Review Guide",
    description: "How the Experience agent scores changes on clarity, consistency, accessibility, and mobile — and what to do when scores are low.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/experience-review-guide.md",
    icon: Star,
    color: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
    audience: "All admins",
  },
  {
    title: "Troubleshooting Guide",
    description: "What to do when a task is stuck, an agent output is wrong, or something unexpected happens.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/troubleshooting-guide.md",
    icon: HelpCircle,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    audience: "All admins",
  },
  {
    title: "Release Workflow Guide",
    description: "The full 17-stage workflow from task creation to production release, with what to do at each stage.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/release-workflow-guide.md",
    icon: Rocket,
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
    audience: "All admins",
  },
  {
    title: "Database Guide",
    description: "All 20 dev_* tables — what they store, what each column means, and the database safety rules.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/database-guide.md",
    icon: Database,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    audience: "Developers",
  },
  {
    title: "Developer Maintenance Guide",
    description: "How to extend, debug, and maintain the module — module structure, access control, migration patterns, and what to never do.",
    href: "https://github.com/John19930614/MACO/blob/master/maco-platform/docs/ai-dev-command-center/developer-maintenance-guide.md",
    icon: Wrench,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    audience: "Developers",
  },
] as const;

export default function DevCommandDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Documentation</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Everything you need to operate and maintain the AI Dev Command Center. Click any guide to open it on GitHub.
        </p>
      </div>

      {/* The one rule */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">The one rule</p>
        <p className="mt-0.5 text-sm text-blue-700 dark:text-blue-300">
          The AI team plans and drafts. You decide if anything happens. No agent can deploy, run a migration, push to GitHub, delete a file, or change login rules without your explicit approval.
        </p>
      </div>

      <Card>
        <CardHeader title="Guides" subtitle="10 plain-English references — no technical background required" right={<BookOpen className="h-4 w-4 text-slate-300" />} />
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {GUIDES.map((g) => {
            const Icon = g.icon;
            return (
              <a
                key={g.title}
                href={g.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${g.color}`}>
                  <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{g.title}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">{g.audience}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{g.description}</p>
                </div>
              </a>
            );
          })}
        </div>
      </Card>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick reference — what AI cannot do</p>
        <ul className="mt-2 space-y-1">
          {[
            "Push code to GitHub without a GitHub approval",
            "Merge a pull request without a GitHub approval",
            "Run a database migration without a database-change approval",
            "Deploy to production without a production-release approval",
            "Delete any file without a file-delete approval",
            "Change login or permission rules without an auth/permission-change approval",
            "Change environment variables without an environment-variable-change approval",
            "Access or store customer data in dev_* tables",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400">✗</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
