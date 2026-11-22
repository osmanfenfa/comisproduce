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
            COMIS is COMIS — A unified platform for managing every produce buying station.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm sm:text-base leading-relaxed text-slate-700">
          <p>
            Developed by <strong>Bukuma Inc.</strong>, COMIS is purpose-built to digitize, organize, and safeguard buying-station operations across cash crops and agricultural commodities, empowering buying businesses, managers, and staff with speed, accuracy, and absolute transparency.
          </p>

          <div className="space-y-3 pt-2">
            <h2 className="text-xl font-bold text-slate-900">Platform Capabilities</h2>
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
                <strong>Light on Data:</strong> Built mobile-first for rural buying centers, with small pages and photos compressed on the phone before upload to keep mobile data costs low.
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
