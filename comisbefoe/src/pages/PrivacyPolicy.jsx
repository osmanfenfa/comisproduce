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
            Version 2.0 · Effective Date: November 2026 · Adds COMIS Market
          </p>
        </div>

        {/* Document Body */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Introduction and Scope</h2>
            <p>
              This Privacy Policy explains how <strong>Bukuma Inc.</strong> ("COMIS," "we," "us") collects, uses, discloses, and safeguards personal data in connection with the COMIS platform (the "Service"). COMIS is offered as a Software as a Service (SaaS) to produce-buying businesses in Sierra Leone and other countries, and this Policy is intended to apply across the jurisdictions in which the Service is offered. It applies to: (a) individuals who hold a System Admin, Produce Manager, or Produce Secretary Account ("Users"); (b) Sellers whose personal information is entered into the Service by Users in the course of produce-buying operations; and (c) farmers, traders, and buying-station staff who use COMIS Market, the marketplace within the Service ("Members").
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
            <p>
              For COMIS Market, COMIS is the data controller of Member accounts, posts, offers, comments, verification documents, and the activity used to personalise the feed. A Member who posts or comments chooses what to publish to other Members.
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
                <strong>3.4 Technical and Audit Data:</strong> Device and browser information, IP address, timestamps associated with logins; immutable audit log entries recording which User performed a given action, and when; and short-lived counters (kept for no more than 24 hours) used to limit repeated logins, codes, posts, and uploads.
              </li>
              <li>
                <strong>3.5 COMIS Market Account Data:</strong> Full name, phone number (used to log in), account type (farmer or trader), district, chiefdom, optional business name, password (stored only as a hash), acceptance of these terms, and the categories you say you buy or sell.
              </li>
              <li>
                <strong>3.6 Profile Photos:</strong> An optional photo of yourself or your business, for every account type. It is shown to other signed-in users next to your posts, comments, and profile.
              </li>
              <li>
                <strong>3.7 Posts and Interactions:</strong> Listings (sell or wanted, category, title, description, quantity, price, location, photos, and video), comments and replies, likes, saves, offers (quantity, price, and message), reports of posts, and the dates of these actions.
              </li>
              <li>
                <strong>3.8 Verification Data:</strong> Confirmation that you verified your phone number with a one-time SMS code; and, if you choose to verify your identity, the type of document (national ID card or passport), a photo of it, its number, and the administrator's decision with any reason given.
              </li>
              <li>
                <strong>3.9 Feed Personalisation Data:</strong> For each category, a score of how strongly you buy or sell it, worked out from your posts, offers, accepted deals, saves, comments, likes, and the posts you open, and from the categories you tick. Scores fade over time unless you ticked the category. We also keep a record of the match alerts sent to you and whether you opened them, and whether each offer came from a member already matched to that category.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. How We Collect Personal Data</h2>
            <p>
              Personal data is collected: (a) directly from Users and Members during account registration and when they post, comment, make offers, upload photos, or verify their account; (b) from Sellers, via Users, at the point of a produce purchase or loan transaction; and (c) automatically through use of the Service (e.g., timestamps, device information, audit log entries, and the activity used to personalise the COMIS Market feed).
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
              <li>Running COMIS Market: showing posts to Members, passing offers between Members, and sharing phone numbers between the two sides of an accepted offer (performance of the service you signed up for);</li>
              <li>Ordering the "For you" feed and sending match alerts so that posts reach the Members most likely to buy or sell that item (legitimate interest in a useful marketplace; you can change the categories you tick at any time);</li>
              <li>Verifying phone numbers and identity documents, preventing one document from being used for several accounts, and moderating reported posts (legitimate interest in a safe marketplace and preventing fraud);</li>
              <li>Showing farmers who have verified their phone number the receipts and loans that buying stations recorded under that same number;</li>
              <li>Measuring, in totals only, whether the feed and alerts lead to offers, so the feed can be improved;</li>
              <li>Complying with applicable legal or regulatory recordkeeping obligations;</li>
              <li>Improving and maintaining the reliability and security of the Service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. How We Use and Share Personal Data</h2>
            <p>
              <strong>Within COMIS Market:</strong> your name, account type, business name, district, chiefdom, profile photo, verified badge, posts, comments, and likes are visible to other signed-in users. Your phone number is never shown on posts. It is shared only with the other person in an offer, and only after the offer is accepted. Your ID document photo and number are never shown to other Members; only you and COMIS administrators can see them. Which categories you buy or sell, and your feed scores, are visible only to you, and are used automatically to order feeds and send alerts.
            </p>
            <p>We do not sell personal data. Outside the Service, personal data may be shared only with:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Infrastructure providers that host, store, or process data on our behalf under contractual confidentiality and security obligations, including cloud application hosting, managed databases, a media-hosting service that stores and delivers post photos, videos, and profile photos, and a temporary data store for security counters;</li>
              <li>SMS and email providers, solely to deliver verification codes, password resets, and (where enabled) match alerts;</li>
              <li>Where enabled, a text-recognition (OCR) provider that reads the document number from an ID photo; otherwise this is done on our own servers;</li>
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
            <p>
              For COMIS Market: posts, photos, and videos are kept until you delete them or an administrator removes them, and deleting a post deletes its photos and video. Comments are kept until deleted by their author, the post owner, or an administrator. An ID document photo is kept privately while your account exists, to support the verification decision and any dispute about it, and is replaced if you upload a new one. Feed personalisation scores fade over time, and alert records are kept with your account. You may ask us to delete your Market account and its data, subject to records we must keep by law.
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
              <li>Data stored on secure servers rather than kept on users' devices;</li>
              <li>ID documents stored in private storage that is never published, and sent only to you and administrators, without caching;</li>
              <li>Uploaded files checked by their content, not their name, and given random file names;</li>
              <li>Limits on repeated login attempts, codes, posts, comments, offers, and uploads to prevent abuse.</li>
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
              Sellers wishing to exercise these rights should contact their registered produce-buying business (the data controller). Users and Members may contact COMIS directly at our official email.
            </p>
            <p>
              Members can also act directly in the app: edit their profile, add or remove their profile photo, delete their posts and comments, and change the categories they buy or sell on the Me page.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">11. Children's Data</h2>
            <p>
              The Service, including COMIS Market, is intended for adults. We do not knowingly create User or Member Accounts for minors. Customers are expected to comply with all applicable laws regarding transactions with, and data of, minors.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">12. Automated Processing</h2>
            <p>
              The Service performs automated calculations (such as moisture-deduction pricing and loan balance calculations) based on figures entered by Users. These calculations support, but do not replace, human decision-making: under the COMIS workflow, a Produce Manager reviews and approves each transaction before an official receipt is issued.
            </p>
            <p>
              In COMIS Market, the order of posts in the "For you" feed and who receives match alerts are decided automatically from the scores described in Section 3.9, your district, how new and popular a post is, and whether the poster is verified. This affects only the order in which you see posts: you can always open the "Latest" feed and search all posts. The document number read from an ID photo is shown to you to confirm or correct, and an administrator decides every verification. No decision with legal or similarly significant effect is made by automated means alone.
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
              We may update this Privacy Policy from time to time. Material changes will be communicated by email, SMS, or in-app notice before taking effect.
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
