import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
            <Link to="/user-agreement" className="hover:text-slate-900">User Agreement</Link>
            <Link to="/about" className="hover:text-slate-900">About COMIS</Link>
          </div>
        </div>

        {/* Document Header */}
        <div className="space-y-2 border-b border-slate-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#168821]">
            Software as a Service (SaaS) Agreement
          </p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500">
            Describing how personal data is collected, used, and protected within the COMIS platform.
          </p>
          <p className="text-xs text-slate-400">
            Version 1.0 · Effective Date: September 2026
          </p>
        </div>

        {/* Document Body */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Introduction and Scope</h2>
            <p>
              This Privacy Policy explains how <strong>Bukuma Inc.</strong> ("COMIS," "we," "us") collects, uses, discloses, and safeguards personal data in connection with the COMIS platform (the "Service"). COMIS is offered as a Software as a Service (SaaS) to produce-buying businesses in Sierra Leone and other countries, and this Policy is intended to apply across the jurisdictions in which the Service is offered. It applies to: (a) individuals who hold a System Admin, Produce Manager, or Produce Secretary Account ("Users"); and (b) Sellers whose personal information is entered into the Service by Users in the course of produce-buying operations.
            </p>
            <p>
              Because our Customers operate in different regions, the specific data protection law that governs a given Customer's use of the Service may vary. Where a Customer is subject to a specific data protection law (such as the EU General Data Protection Regulation or national privacy regulations), that law governs to the extent it provides greater protection or imposes stricter requirements than this Policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">2. Roles: Data Controller and Data Processor</h2>
            <p>
              For Seller personal data entered into the Service, the registered Customer business (through its Produce Manager and administrators) is generally the data controller — it determines why and how Seller data is collected and used in its own produce-buying operations. COMIS acts as the data processor, providing the technical platform on which that data is stored and processed, and processes such data only on the Customer's instructions and for the purposes described in this Policy and the Terms of Service.
            </p>
            <p>
              For User account data (the information of System Admins, Produce Managers, and Produce Secretaries themselves), COMIS acts as a data controller for the limited purposes of account administration, security, and authentication.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">3. Personal Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>
                <strong>3.1 User Account Data:</strong> Full name, phone number or email address (used as login identifier), password (stored as an irreversible cryptographic hash, never in plain text), assigned role, and account status. For Produce Manager self-registration: business name, business address, and business contact details.
              </li>
              <li>
                <strong>3.2 Seller Data:</strong> Full name, gender, physical address, contact/phone number, and a photograph (where optionally provided for identity confirmation).
              </li>
              <li>
                <strong>3.3 Transaction, Loan, and Receipt Data:</strong> Produce purchase records (commodity type, weight in kg, number of bags, moisture percentage, price per kilogram, computed net weight, total price, date, and status); loan records (amount taken, repayments, due dates, balance, and status); and receipt records (receipt number, amount, issuing staff snapshot, and timestamp).
              </li>
              <li>
                <strong>3.4 Technical and Audit Data:</strong> Device and browser information, IP address, timestamps associated with logins; and immutable audit log entries recording which User performed a given action, and when.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. How We Collect Personal Data</h2>
            <p>
              Personal data is collected: (a) directly from Users during account registration; (b) from Sellers, via Users, at the point of a produce purchase or loan transaction; and (c) automatically through use of the Service (e.g., timestamps, device information, and audit log entries generated by the system itself).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. Purposes and Legal Basis for Processing</h2>
            <p>We process personal data for the following legitimate purposes:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Performance of produce-buying and loan-management functions (contractual necessity / legitimate business interest);</li>
              <li>Authenticating Users and enforcing role-based permissions (legitimate interest in platform security);</li>
              <li>Maintaining audit logs to protect the integrity of records and protect Users from false accusations;</li>
              <li>Generating receipts, reports, supply records, and dashboards for the Customer's own business operations;</li>
              <li>Complying with applicable legal or regulatory recordkeeping obligations;</li>
              <li>Improving and maintaining the reliability and security of the Service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. How We Use and Share Personal Data</h2>
            <p>We do not sell personal data. Personal data may be shared only with:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Infrastructure providers that host, store, or process data on our behalf under contractual confidentiality and security obligations (cloud application hosting, managed databases, and content delivery);</li>
              <li>Optional third-party sign-in providers (e.g., Google), solely if a User chooses to authenticate with Google;</li>
              <li>Government or regulatory authorities, where disclosure is required by law or court order;</li>
              <li>A successor entity in the event of a merger, acquisition, or sale of business assets.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. International Data Transfers</h2>
            <p>
              Because the Service relies on cloud infrastructure providers, data may be processed on secure servers located in cloud data centers. We select providers that maintain industry-standard technical and organizational security measures to safeguard data in transit and at rest.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">8. Data Retention</h2>
            <p>
              We retain personal data for as long as the associated Customer account remains active, and thereafter for a period consistent with standard business and financial recordkeeping practice (default retention period of seven years for transaction, loan, and receipt records following account closure), unless a longer retention period is required by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">9. Data Security</h2>
            <p>We apply robust technical and organizational security measures, including:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Encryption of data in transit via HTTPS/TLS;</li>
              <li>One-way cryptographic hashing of passwords (no plain-text password storage);</li>
              <li>Role-based access control enforced at the server API level;</li>
              <li>Append-only audit logging of transactions, loans, and receipts;</li>
              <li>Data stored on secure servers rather than kept on users' devices.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">10. Rights of Sellers and Users</h2>
            <p>Subject to applicable law, individuals may request to:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Access the personal data held about them;</li>
              <li>Request correction of inaccurate or incomplete personal data;</li>
              <li>Object to processing or request deletion where not conflicting with legal or financial recordkeeping requirements;</li>
              <li>Receive a portable copy of their personal data where technically feasible.</li>
            </ul>
            <p>
              Sellers wishing to exercise these rights should contact their registered produce-buying business (the data controller). Users may contact COMIS directly at our official email.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">11. Children's Data</h2>
            <p>
              The Service is intended for use by adult business operators and staff. We do not knowingly create User Accounts for minors. Customers are expected to comply with all applicable laws regarding transactions with, and data of, minors.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">12. Automated Processing</h2>
            <p>
              The Service performs automated calculations (such as moisture-deduction pricing and loan balance calculations) based on figures entered by Users. These calculations support, but do not replace, human decision-making: under the COMIS workflow, a Produce Manager reviews and approves each transaction before an official receipt is issued.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">13. Data Breach Notification</h2>
            <p>
              In the event of a data breach that poses a risk to affected individuals, we will notify the affected Customer without undue delay (targeted within 72 hours of becoming aware of the breach), enabling appropriate mitigation steps.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated to System Admin and Produce Manager accounts by email or in-app notice prior to taking effect.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">15. Contact Us</h2>
            <p>Questions, requests, or concerns regarding this Privacy Policy may be directed to:</p>
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
