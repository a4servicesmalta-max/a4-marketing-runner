export interface DeptManager {
  id: string;        // stable key + tag suffix
  label: string;     // "Admin", "Marketing", ...
  teamName: string;  // must match public.teams.name for assignment
  /** Standing daily/weekly responsibilities — starter content, edit freely. */
  playbook: string[];
}

export const MANAGERS: DeptManager[] = [
  {
    id: "admin",
    label: "Admin",
    teamName: "Admin / Operations",
    playbook: [
      "Triage the shared inbox (info@a4.com.mt) and make sure anything actionable has an owner.",
      "Check today's calendar/meetings — confirm links/rooms and that agendas exist.",
      "Review client onboarding/KYC in progress; chase any missing documents.",
      "Update engagement/job statuses; flag deliverables that are overdue or due this week.",
      "Check yesterday's timesheets were submitted; nudge anyone missing.",
      "Handle supplier/admin email, invoices, and payments due.",
      "File incoming scans/post into the correct client folders.",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    teamName: "Sales & Marketing",
    playbook: [
      "Review inbound leads/enquiries from yesterday — each needs an owner and a next step.",
      "Publish or schedule today's planned social content (LinkedIn first).",
      "Move the content calendar forward by one concrete piece.",
      "Check website/contact-form submissions and follow up.",
      "Send any follow-ups due in active nurture sequences.",
      "Note any brand mentions or competitor moves worth acting on.",
      "On Mondays: plan the week's content and campaigns.",
    ],
  },
  {
    id: "audit",
    label: "Audit",
    teamName: "Audit",
    playbook: [
      "Review active engagements: status vs plan and any filing/reporting deadlines approaching.",
      "Set today's fieldwork priorities for each live job.",
      "Clear outstanding review notes and EQR points.",
      "Check client evidence received vs requested; chase the gaps.",
      "Confirm independence/acceptance items for any new engagements.",
      "Prepare for client meetings scheduled today.",
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    teamName: "Accounting",
    playbook: [
      "Post and reconcile the day's bank transactions for active clients.",
      "Flag VAT/tax deadlines falling this week and what's needed for each.",
      "Chase outstanding client records needed for management accounts.",
      "Progress management accounts that are in preparation/review.",
      "Handle payroll items due for the period (FS5, payslips).",
      "Respond to client accounting queries.",
    ],
  },
];

export function getManager(id: string): DeptManager | undefined {
  return MANAGERS.find((m) => m.id === id);
}
