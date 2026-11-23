import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function About() {
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
            <Link to="/terms" className="hover:text-slate-900">Terms</Link>
            <Link to="/user-agreement" className="hover:text-slate-900">Agreement</Link>
            <Link to="/privacy" className="hover:text-slate-900">Privacy</Link>
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            About COMIS
          </h1>
          <p className="text-lg font-bold text-[#168821]">
            One platform for produce buying stations, and a marketplace that connects farmers, traders, and stations.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm sm:text-base leading-relaxed text-slate-700">
          <p>
            Developed by <strong>Bukuma Inc.</strong>, COMIS digitizes, organizes, and safeguards buying-station operations across cash crops and agricultural commodities. Through <strong>COMIS Market</strong>, it also lets farmers, traders, and buying stations find each other, post what they have to sell or want to buy, and agree deals directly.
          </p>

          <div className="space-y-3 pt-2">
            <h2 className="text-xl font-bold text-slate-900">COMIS Market</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>
                <strong>Sign Up with a Phone Number:</strong> Farmers and traders create a free account with their phone number, district, and chiefdom, and can start using the market straight away. Buying stations use the market from their existing station accounts.
              </li>
              <li>
                <strong>Sell and Wanted Posts:</strong> Post produce, livestock, inputs, and other goods for sale, or post what you want to buy, with quantity, price in Leones, location, up to six photos, and one short video.
              </li>
              <li>
                <strong>A Feed That Knows What You Trade:</strong> The "For you" feed shows each post first to the people on the other side of it. A cassava sale goes first to people who buy cassava, and a request for cassava goes first to people who sell it. COMIS learns this from your posts, offers, and saves, and from the categories you tick under "What do you buy and sell?".
              </li>
              <li>
                <strong>Match Alerts:</strong> When someone posts what you buy or sell, you get an alert in My Activity, nearby posts first. Phone-verified members can also get an SMS, at most one a day.
              </li>
              <li>
                <strong>Offers and Safe Contact Sharing:</strong> Make an offer on any post. Phone numbers are shown only to the two people in an offer, and only after it is accepted.
              </li>
              <li>
                <strong>Like, Comment, Share, and Save:</strong> Ask questions and reply on any post, and save posts to find them again later.
              </li>
              <li>
                <strong>Verified Members:</strong> Members can verify their phone number by SMS code and their identity with a photo of a national ID card or passport. COMIS reads the document number automatically, and an administrator checks every document before the verified badge is given.
              </li>
              <li>
                <strong>Your Station Records:</strong> Farmers who verify their phone number can see the receipts and loans recorded for them by the buying stations they sell to.
              </li>
              <li>
                <strong>Profile Photos and Moderation:</strong> Every member can add a profile photo. Members can report posts, and administrators remove posts that break the rules.
              </li>
            </ul>
          </div>

          <div className="space-y-3 pt-2">
            <h2 className="text-xl font-bold text-slate-900">Buying Station Capabilities</h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>
                <strong>Intelligent Intake & Moisture Deduction:</strong> Automates moisture testing and net weight calculations for Cocoa purchases using standard proportional deduction formulas, alongside flat intake pricing for Coffee and Cola Nut.
              </li>
              <li>
                <strong>Kilogram & Bag Tracking:</strong> Records both scale weight in kilograms and physical bag counts for all purchases, giving warehouse and transport teams clear control over stock inventory.
              </li>
              <li>
                <strong>Role-Based Verification:</strong> Enforces strict division of responsibility: Produce Secretaries record purchase intakes, Produce Managers verify weights and authorize payouts, and System Admins manage business settings.
              </li>
              <li>
                <strong>Loans, Deductions & Receipts:</strong> Built-in micro-loan tracking for registered farmers. When produce is sold, pending loan installments are cleanly deducted, and an itemized printed receipt is issued.
              </li>
              <li>
                <strong>Supply Outbound to Buyer Companies:</strong> Streamlines outbound produce sales from stations to large buyer companies, recording total kilograms, bags, water percentages, and witness signatures.
              </li>
              <li>
                <strong>Light on Data:</strong> Built mobile-first for rural areas. Photos are compressed on the phone before upload and delivered in small, phone-sized versions to keep mobile data costs low.
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Corporate Information</h2>
            <p className="font-semibold text-slate-900">Bukuma Inc.</p>
            <p className="text-slate-600">Address: Fachima Block, The Village. KC, SL</p>
            <p className="text-slate-600">
              Email:{" "}
              <a href="mailto:comisworldproduce@gmail.com" className="text-[#168821] font-semibold hover:underline">
                comisworldproduce@gmail.com
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 text-center">
          <p>© {new Date().getFullYear()} Bukuma Inc. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
