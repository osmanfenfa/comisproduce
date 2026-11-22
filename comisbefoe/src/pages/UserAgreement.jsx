import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function UserAgreement() {
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Simple Top Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#168821] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <Link to="/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link to="/about" className="hover:text-slate-900">About COMIS</Link>
          </div>
        </div>

        {/* Document Header */}
        <div className="space-y-2 border-b border-slate-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#168821]">
            Software as a Service (SaaS) Agreement
          </p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            User Agreement
          </h1>
          <p className="text-sm text-slate-500">
            For individual System Admin, Produce Manager, and Produce Secretary account holders.
          </p>
          <p className="text-xs text-slate-400">
            Version 1.0 · Effective Date: September 2026
          </p>
        </div>

        {/* Document Body */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Purpose of This Agreement</h2>
            <p>
              This User Agreement ("Agreement") applies to every individual ("User," "you") who is issued a login to the COMIS platform (the "Service"), operated by <strong>Bukuma Inc.</strong>, under the role of System Admin, Produce Manager, or Produce Secretary, regardless of whether you are an owner, employee, or contractor of the registered Customer business. This Agreement supplements, and should be read together with, the Terms of Service governing the Customer's account.
            </p>
            <p>
              By logging in and using an assigned Account, you acknowledge that you have read, understood, and agree to comply with this Agreement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">2. Your Role and Its Permissions</h2>
            <p>The Service assigns each User exactly one role, each with a distinct set of permissions:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>
                <strong>System Admin:</strong> Approves Produce Manager accounts, has visibility into system accounts, users, commodities, and audit logs, manages system-wide global settings, and may suspend accounts. A System Admin does not perform day-to-day station purchase entry or view station financial receipts and reports.
              </li>
              <li>
                <strong>Produce Manager:</strong> Creates and manages Produce Secretary accounts, registers and manages Sellers, reviews and approves or rejects purchases submitted by a Produce Secretary, issues official receipts, records bulk buyer supplies, and creates and manages loans.
              </li>
              <li>
                <strong>Produce Secretary:</strong> Registers Sellers, records cocoa, coffee, and cola nut purchases with bag counts and weight data (submitted as "Pending" until reviewed), and views the status of their own submissions. A Produce Secretary cannot approve their own transactions, issue receipts, or create or approve loans.
              </li>
            </ul>
            <p>
              You agree to act only within the permissions of your assigned role and understand that the Service enforces these permissions at the system level — attempting to access functionality outside your role (including through technical means) is a violation of this Agreement.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">3. Login Credentials and Account Security</h2>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>You will keep your password confidential and will not share your login credentials with any other person, including co-workers of a different role.</li>
              <li>You are responsible for all activity recorded under your Account, whether or not you personally performed it, except where you have promptly reported unauthorized access as described in Section 9.</li>
              <li>You will use a strong, unique password and will change it immediately if you suspect it has been compromised.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. Accuracy of Data Entry</h2>
            <p>
              You agree to enter all information — including Seller names, addresses, contact details, produce weights, moisture percentages, prices, bag counts, and loan figures — accurately and in good faith. You understand that the Service's pricing calculations depend entirely on the figures you enter, and that inaccurate entries can result in a Seller being underpaid or overpaid.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. The Approval Workflow</h2>
            <p>
              If you hold the Produce Secretary role, you acknowledge that a purchase you record is not final until a Produce Manager reviews and approves it, and that only an approved (finalized) transaction may be receipted. If your submission is rejected, you will review the Produce Manager's stated reason, correct the record accordingly, and resubmit it rather than creating a duplicate entry.
            </p>
            <p>
              If you hold the Produce Manager role, you acknowledge that approving a transaction is a representation that you have verified the recorded weight, moisture percentage, and price with reasonable care before authorizing payment and issuing a receipt to the Seller.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. Audit Logging</h2>
            <p>
              You acknowledge and consent that the Service records an immutable audit log of significant actions taken under your Account, including creation, approval, rejection, and edits to transactions, loans, and receipts, together with the date, time, and your User identity. This logging exists to protect the integrity of the buying station's records and to protect Users themselves from false accusation, and is not intended as, and should not be treated as, general surveillance of your work.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. Handling of Seller Personal Data</h2>
            <p>
              In the course of using the Service you will have access to personal information belonging to Sellers (including name, gender, address, contact number, and photo where applicable). You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Collect and enter such information only for legitimate produce-buying or loan-management purposes;</li>
              <li>Not disclose Seller personal information to any third party outside the ordinary course of the Customer's business;</li>
              <li>Handle such information in accordance with the Customer's obligations under the Privacy Policy.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">8. Loans (Produce Manager and System Admin Only)</h2>
            <p>
              If your role permits you to create or approve loans, you agree to do so only in accordance with the Customer's internal lending practices, to record repayments promptly and accurately, and not to create, alter, or forgive a loan for personal benefit or without proper authorization from the Customer.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">9. Reporting Security Incidents</h2>
            <p>
              You will notify your Produce Manager or System Admin immediately if you suspect that: your credentials have been compromised; your device has been lost or stolen while logged into the Service; or any transaction, loan, or receipt appears to have been altered without proper authorization.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">10. Prohibited Conduct</h2>
            <p>You will not:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Falsify or manipulate weight, moisture percentage, price, bag counts, or loan figures for personal gain or to disadvantage a Seller;</li>
              <li>Attempt to approve, reject, or issue a receipt for your own submitted transaction if your role does not permit this;</li>
              <li>Attempt to disable, bypass, or interfere with the audit logging or approval workflow;</li>
              <li>Use your Account access to obtain Seller or Customer information for any purpose unrelated to your assigned duties;</li>
              <li>Create or use an Account on behalf of a person who is not who they claim to be.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">11. Internet Connection</h2>
            <p>
              You understand that COMIS needs an internet connection to record and view data. Entries are saved only once the server confirms them; if the connection fails, re-enter the entry when you are back online.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">12. Consequences of Violation</h2>
            <p>
              Violation of this Agreement may result in suspension or termination of your Account access, at the discretion of the Customer's System Admin and/or Produce Manager, and, where the conduct involves fraud, falsification of records, or theft, may be reported to the Customer's management and, where appropriate, to law enforcement authorities.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">13. Termination of Access</h2>
            <p>
              Your access under this Agreement terminates automatically upon: (a) deactivation of your Account by a Produce Manager or System Admin; (b) the end of your employment or engagement with the Customer; or (c) termination of the Customer's own account under the Terms of Service. You agree to immediately cease using the Service upon any such termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">14. Acknowledgment</h2>
            <p>
              By logging into the Service, you confirm that you have read and agree to this User Agreement, that the information you provided to create your Account is accurate, and that you understand the responsibilities attached to your assigned role.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-200">
            <p className="font-semibold text-slate-900">Bukuma Inc.</p>
            <p className="text-slate-600">Address: Fachima Block, The Village. KC, SL</p>
            <p className="text-slate-600">
              Email:{" "}
              <a href="mailto:comisworldproduce@gmail.com" className="text-[#168821] font-semibold hover:underline">
                comisworldproduce@gmail.com
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 text-center">
          <p>© {new Date().getFullYear()} Bukuma Inc. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
