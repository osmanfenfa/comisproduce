import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
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
            <Link to="/user-agreement" className="hover:text-slate-900">User Agreement</Link>
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
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500">
            Governing the use of the COMIS platform by registered buying-station businesses, and of COMIS Market by farmers, traders, and buying stations, wherever located.
          </p>
          <p className="text-xs text-slate-400">
            Version 2.0 · Effective Date: November 2026 · Adds COMIS Market
          </p>
        </div>

        {/* Document Body */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between <strong>Bukuma Inc.</strong> ("COMIS," "we," "us," or "our") and the produce-buying business that registers a Produce Manager account (the "Customer," "you," or "your"). COMIS is provided as a Software as a Service (SaaS) — a cloud-hosted platform accessed over the internet, with no installed software licensed to the Customer — and is offered to Customers in Sierra Leone and other countries. By registering an account, accessing, or using the COMIS platform (the "Service"), you agree to be bound by these Terms. If you do not agree, you must not register for or use the Service.
            </p>
            <p>
              You represent that you have the authority to bind the business or entity on whose behalf you are registering, and that all information provided during registration is accurate and current.
            </p>
            <p>
              Farmers and traders who sign up for COMIS Market ("Members") also accept these Terms. For a Member, "you" means the Member, and the sections that apply are those on COMIS Market (Section 7) together with Sections 1, 2, 6 and 9 to 23 as far as they are relevant to an individual Member.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">2. Definitions</h2>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>"Service"</strong> means the COMIS mobile-first web application, including all associated APIs and dashboards.</li>
              <li><strong>"Account"</strong> means a registered System Admin, Produce Manager, or Produce Secretary login within the Service.</li>
              <li><strong>"Customer Data"</strong> means all data entered into the Service by or on behalf of the Customer, including Seller information, produce transaction records, loan records, receipts, and supply shipments.</li>
              <li><strong>"Seller"</strong> means an individual farmer or produce supplier whose information is recorded within the Service by Customer staff.</li>
              <li><strong>"Authorized Users"</strong> means the individuals the Customer permits to access the Service under the System Admin, Produce Manager, or Produce Secretary roles.</li>
              <li><strong>"COMIS Market"</strong> means the marketplace within the Service where Members and buying stations post goods for sale or wanted, interact with posts, and make offers.</li>
              <li><strong>"Member"</strong> means a farmer or trader with a COMIS Market account, and, when using COMIS Market, a Produce Manager or Produce Secretary acting for their station.</li>
              <li><strong>"Listing"</strong> means a sell or wanted post on COMIS Market, including its text, price, photos, and video.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">3. Eligibility and Account Registration</h2>
            <p>
              A Produce Manager account is created via self-service registration and remains in a pending state until approved by a System Admin, as described in the Service's account-approval workflow. The Customer is responsible for ensuring that any Produce Manager it designates has the authority to create and manage Produce Secretary accounts on the Customer's behalf.
            </p>
            <p>
              The Customer must provide accurate business information (business name, address, contact details) during registration and must promptly update this information if it changes. COMIS reserves the right to refuse, suspend, or revoke approval of any account where information provided is false, incomplete, or cannot be verified.
            </p>
            <p>
              A farmer or trader may register one COMIS Market account per phone number. The account is active immediately and needs no approval. Members must be adults and must give their real name and location.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. Description of the Service</h2>
            <p>
              COMIS provides a role-based digital platform for recording cocoa, coffee, and cola nut produce purchases (including automated moisture-deduction and weight-based pricing calculations), managing seller records, managing loans issued to sellers, generating official receipts, tracking bag quantities, recording bulk supplies to buyers, and producing operational reports. Through COMIS Market, it also lets Members and buying stations post goods for sale or wanted, receive offers, and be matched with the people who buy or sell the same goods. The Service requires an internet connection to record and view data.
            </p>
            <p>
              COMIS may add, modify, or remove features of the Service at its discretion, and will make reasonable efforts to notify Customers of material changes that affect core functionality.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. User Roles and Customer Responsibilities</h2>
            <p>
              The Service enforces three roles: System Admin, Produce Manager, and Produce Secretary, each with defined permissions as described in the Service's documentation. The Customer is solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Assigning roles appropriately and only to individuals authorized to perform the corresponding functions;</li>
              <li>Ensuring Produce Secretary staff understand that their recorded transactions require Produce Manager review and approval before a receipt is issued;</li>
              <li>Promptly deactivating accounts of staff who no longer work for the Customer or who no longer require access;</li>
              <li>The accuracy of all Seller information, weights, moisture percentages, prices, bag counts, and loan figures entered by its Authorized Users.</li>
            </ul>
            <p>
              COMIS is not responsible for losses arising from a Customer's failure to manage its own Authorized Users' access appropriately, including failure to revoke access from a terminated employee.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. Acceptable Use</h2>
            <p>The Customer agrees that Authorized Users will not:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li>Falsify weight, moisture percentage, price, bag counts, or loan figures with intent to defraud a Seller, the Customer, or any third party;</li>
              <li>Share login credentials between individuals or allow an unauthorized person to access the Service under another user's account;</li>
              <li>Attempt to bypass, disable, or circumvent the Service's role-based permission controls or approval workflow;</li>
              <li>Use the Service to collect, store, or process Seller data for any purpose unrelated to legitimate produce-buying and loan-management operations;</li>
              <li>Reverse-engineer, decompile, scrape, or attempt to extract the Service's source code or underlying data structures, except as permitted by law;</li>
              <li>Use the Service in violation of any applicable law of the Republic of Sierra Leone or any other jurisdiction in which the Customer operates.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. COMIS Market</h2>
            <p>
              <strong>7.1 COMIS is not a party to trades.</strong> COMIS Market helps Members and buying stations find each other. Deals, prices, quality checks, delivery, and payment are agreed and carried out directly between the people involved, outside the Service. COMIS does not hold money, does not guarantee that any person will pay, deliver, or describe goods truthfully, and is not responsible for any loss arising from a trade.
            </p>
            <p>
              <strong>7.2 Listings.</strong> You may post only goods you lawfully own or are authorised to sell, or goods you genuinely want to buy. Listings must be honest about the item, quantity, quality, price, and location, and photos and videos must show the actual goods. Mark a listing as fulfilled or close it when it is no longer available. Prohibited listings include stolen goods, illegal drugs, weapons, protected wildlife, counterfeit items, and anything that cannot lawfully be sold where you are.
            </p>
            <p>
              <strong>7.3 Offers and contact details.</strong> An offer is an invitation to agree a deal, not a binding contract until both people agree it. When an offer is accepted, the phone numbers of both people are shown to each other so they can complete the deal. You must use the other person's number only for that deal and must not pass it on.
            </p>
            <p>
              <strong>7.4 Comments, photos, and conduct.</strong> Comments, replies, and profile photos must be respectful and lawful. Harassment, threats, scams, spam, and posting other people's personal details are not allowed.
            </p>
            <p>
              <strong>7.5 Verification.</strong> Members may verify their phone number by SMS code and their identity with a photo of their own national ID card or passport. You must not upload another person's document or a forged one, and one document may verify only one account. The verified badge means an administrator checked the document. It is not a guarantee of the Member's honesty or of any trade.
            </p>
            <p>
              <strong>7.6 Feed, matches, and alerts.</strong> The "For you" feed orders posts and sends match alerts based on what each Member buys and sells, as described in the Privacy Policy. Where enabled, phone-verified Members may receive up to one SMS alert a day. The order of the feed is not a recommendation or endorsement of any Member or Listing.
            </p>
            <p>
              <strong>7.7 Licence to your content.</strong> You keep ownership of what you post. You grant COMIS a non-exclusive, royalty-free licence to store, resize, compress, and display your Listings, photos, videos, and comments to other users of the Service for as long as they remain on COMIS Market.
            </p>
            <p>
              <strong>7.8 Reports and moderation.</strong> Any user may report a Listing. COMIS administrators may remove Listings or comments, and suspend accounts, that break these Terms, with or without notice.
            </p>
            <p>
              <strong>7.9 Fees.</strong> COMIS Market is currently free for Members. If fees are introduced, they will be announced in advance and will apply only from the date announced.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">8. Fees and Payment</h2>
            <p>
              Current pricing, subscription tiers, and payment terms (if any) will be communicated separately at the time of registration or upgrade. COMIS reserves the right to introduce, modify, or discontinue paid tiers with reasonable advance notice to existing Customers. Fees, once paid, are non-refundable except as required by law or as expressly stated in a separate order form or invoice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">9. Data Ownership and License</h2>
            <p>
              As between the Customer and COMIS, the Customer retains ownership of all Customer Data. The Customer grants COMIS a limited, non-exclusive license to host, process, store, transmit, and display Customer Data solely as necessary to provide, maintain, and improve the Service. COMIS will not sell Customer Data or Seller personal data to third parties.
            </p>
            <p>
              Upon termination of the Customer's account, COMIS will make Customer Data available for export for a reasonable period (not less than thirty days) before deletion, except where retention is required by law or for legitimate audit purposes as described in the Privacy Policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">10. Intellectual Property</h2>
            <p>
              The Service, including its software, design, workflows, trademarks, and the COMIS name and logo, is the property of Bukuma Inc. and its licensors. Nothing in these Terms grants the Customer any right, title, or interest in the Service's underlying intellectual property, other than the limited right to use the Service as set out herein.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">11. Third-Party Services</h2>
            <p>
              The Service may rely on third-party infrastructure providers (including cloud hosting, database, media hosting for photos and videos, SMS and email delivery, text recognition for ID documents where enabled, and authentication providers) to deliver its functionality. The Service may also offer optional third-party sign-in (e.g., Google). Use of such third-party sign-in is subject to that provider's own terms and privacy practices, over which COMIS has no control.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">12. Service Availability and Support</h2>
            <p>
              COMIS will use commercially reasonable efforts to maintain the availability of the Service but does not guarantee uninterrupted or error-free operation. Scheduled maintenance, third-party infrastructure outages, or connectivity issues at the Customer's location may affect availability. The Service cannot be used while the Customer's device has no internet connection.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">13. Suspension and Termination</h2>
            <p>
              COMIS may suspend or terminate a Customer's or Authorized User's access to the Service, with or without notice, in cases including but not limited to: suspected fraud, violation of Section 6 (Acceptable Use) or Section 7 (COMIS Market), non-payment of applicable fees, or where required to comply with law or protect the security or integrity of the Service.
            </p>
            <p>
              The Customer may terminate its account at any time by written request. Termination does not relieve the Customer of any payment obligations accrued prior to termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">14. Disclaimers</h2>
            <p className="text-slate-600 italic">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. COMIS DOES NOT WARRANT THAT THE SERVICE'S PRICING CALCULATIONS WILL BE FREE FROM ERROR ARISING FROM INACCURATE DATA ENTERED BY AUTHORIZED USERS, AND THE CUSTOMER REMAINS RESPONSIBLE FOR VERIFYING FIGURES BEFORE ISSUING PAYMENT OR A RECEIPT TO A SELLER.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">15. Limitation of Liability</h2>
            <p className="text-slate-600 italic">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, COMIS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM OR RELATED TO THE CUSTOMER'S USE OF THE SERVICE. COMIS'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS SHALL NOT EXCEED THE FEES PAID BY THE CUSTOMER TO COMIS IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">16. Indemnification</h2>
            <p>
              The Customer agrees to indemnify and hold harmless COMIS, Bukuma Inc., its officers, employees, and agents from any claims, damages, liabilities, and expenses (including reasonable legal fees) arising from: (a) the Customer's or its Authorized Users' violation of these Terms; (b) disputes between the Customer and any Seller arising from produce purchases or loans recorded through the Service; (c) any trade or dispute between Members or buying stations arranged through COMIS Market, or any Listing, photo, or comment you post; or (d) the Customer's violation of applicable law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">17. Confidentiality</h2>
            <p>
              Each party agrees to protect the other's confidential information with at least the same degree of care it uses for its own confidential information of similar nature, and not to disclose such information to third parties except as necessary to perform its obligations under these Terms or as required by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">18. Data Protection</h2>
            <p>
              COMIS's collection, use, and processing of personal data (including Seller personal data) is governed by the Privacy Policy, which is incorporated into these Terms by reference. The Customer acknowledges that it is generally the data controller for Seller personal data it enters into the Service, and COMIS acts as a data processor providing the technical means for such processing, as further described in the Privacy Policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">19. Compliance with Law; Responsible Lending</h2>
            <p>
              The Customer is solely responsible for ensuring that its produce-buying and loan-issuance practices comply with all applicable laws of the country or countries in which it operates, including any licensing, consumer protection, agricultural-commodity, or lending-related requirements that may apply to its business. COMIS provides tools to record and calculate loan balances but does not provide legal, tax, financial, or lending-compliance advice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">20. Force Majeure</h2>
            <p>
              Neither party shall be liable for any failure or delay in performance due to circumstances beyond its reasonable control, including natural disasters, internet or power infrastructure failures, government action, or civil unrest.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">21. Changes to These Terms</h2>
            <p>
              COMIS may update these Terms from time to time. Material changes will be notified to registered Produce Manager and System Admin accounts, and to Members, by email, SMS, or in-app notice at least fourteen days before taking effect. Continued use of the Service after the effective date of any change constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">22. General Provisions</h2>
            <ul className="list-disc pl-6 space-y-1 text-slate-700">
              <li><strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and any order form, constitute the entire agreement between the parties regarding the Service.</li>
              <li><strong>Severability:</strong> If any provision of these Terms is found unenforceable, the remaining provisions shall remain in full force and effect.</li>
              <li><strong>Assignment:</strong> The Customer may not assign its rights or obligations under these Terms without COMIS's prior written consent. COMIS may assign these Terms in connection with a merger, acquisition, or sale of assets.</li>
              <li><strong>No Waiver:</strong> Failure to enforce any provision of these Terms shall not constitute a waiver of that provision.</li>
            </ul>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">23. Contact Information</h2>
            <p>Questions regarding these Terms may be directed to:</p>
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
