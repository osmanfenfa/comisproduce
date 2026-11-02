import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { 
  Mail, Lock, MapPin, Phone, Building2,
  LayoutGrid, Eye, EyeOff, AlertCircle, CheckCircle2,
  KeyRound, ArrowLeft, X, Sparkles, Loader2
} from "lucide-react";
import LegalModal from "../components/shared/LegalModal.jsx";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "373563051980-avoohd3l5p9dd25l1aom3pkad0df8nof.apps.googleusercontent.com";

export default function Login({ initialMode = "signin" }) {
  const [searchParams] = useSearchParams();
  const resetTokenParam = searchParams.get("reset_token");

  const [isRegister, setIsRegister] = useState(initialMode === "signup");

  // Sign In fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up fields (SaaS Produce Manager)
  const [produceName, setProduceName] = useState("");
  const [address, setAddress] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);

  // Legal Modal
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState("terms");

  // Forgot Password Modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter code & new pass
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  // Google Authentication State
  const [googleLoading, setGoogleLoading] = useState(false);

  // UI state
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // Ensure Google Identity Services script is available
  useEffect(() => {
    if (!window.google?.accounts?.oauth2) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // If redirected with ?reset_token=xyz, open the reset password modal directly on Step 2
  useEffect(() => {
    if (resetTokenParam) {
      setForgotCode(resetTokenParam);
      setForgotStep(2);
      setShowForgotModal(true);
    }
  }, [resetTokenParam]);

  // Handle Sign In
  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { data } = await client.post("/auth/login", {
        email: loginEmail,
        contact: loginEmail,
        password: loginPassword,
      });

      login({
        token: data.access_token,
        role: data.role,
        name: data.name,
        userId: data.user_id,
        produceId: data.produce_id,
        produceName: data.produce_name || data.business_name || data.station_name,
        stationName: data.station_name || data.produce_name,
      });
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.detail || "Login failed. Check your email and password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Handle Sign Up
  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isAgreed) {
      setError("You must agree to the Terms of Service, User Agreement, and Privacy Policy before signing up.");
      return;
    }

    if (regPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      await client.post("/users/managers", {
        business_name: produceName,
        address: address,
        email: regEmail,
        phone_number: phoneNumber,
        password: regPassword,
      });

      setSuccess("Account registered successfully! Awaiting System Admin confirmation.");
      setLoginEmail(regEmail);
      setIsRegister(false);
      setRegPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err.response?.data?.detail || "Registration failed. Please check your information.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Forgot Password: Step 1 (Request 6-digit code via email)
  async function handleSendForgotEmail(e) {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    setForgotLoading(true);

    try {
      await client.post("/auth/forgot-password", {
        email: forgotEmail.trim(),
      });
      setForgotSuccess("Instructions and 6-digit code sent. Please check your inbox.");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.detail || "Failed to send reset code. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  // Forgot Password: Step 2 (Reset password with code)
  async function handleResetPassword(e) {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (newPassword !== confirmNewPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setForgotError("Password must be at least 8 characters long.");
      return;
    }

    setForgotLoading(true);
    try {
      await client.post("/auth/reset-password", {
        token: forgotCode.trim(),
        // The 6-digit code is only accepted together with the email it was sent to
        email: forgotEmail.trim() || undefined,
        new_password: newPassword,
      });

      setShowForgotModal(false);
      setSuccess("Password has been successfully reset! You can now log in with your new password.");
      if (forgotEmail) setLoginEmail(forgotEmail);
      setForgotCode("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setForgotError(err.response?.data?.detail || "Invalid or expired reset code. Please request a new one.");
    } finally {
      setForgotLoading(false);
    }
  }

  // Native Google Account Chooser & Authentication
  function triggerGoogleAuth(mode = "signin", forceTerms = false) {
    setError("");
    setSuccess("");

    if (mode === "signup" && !forceTerms && !isAgreed) {
      setError("You agree with the Terms of Service, User Agreement, and Privacy Policy. Click Yes to continue.");
      return;
    }

    const effectiveTerms = mode === "signup" ? (forceTerms || isAgreed) : false;

    if (!window.google?.accounts?.oauth2) {
      setError("Google Sign-In is initializing. Please try again in a moment.");
      return;
    }

    setGoogleLoading(true);

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "email profile openid",
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setGoogleLoading(false);
            console.error("Google OAuth error:", tokenResponse);
            setError("Google sign-in was canceled or failed.");
            return;
          }

          if (!tokenResponse.access_token) {
            setGoogleLoading(false);
            setError("Google did not return an access token.");
            return;
          }

          try {
            // 1. Authenticate real user profile directly from Google's official userinfo API
            const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            if (!profileRes.ok) {
              throw new Error("Failed to verify Google user profile.");
            }

            const profile = await profileRes.json();
            const verifiedEmail = (profile.email || "").trim().toLowerCase();
            const verifiedName = (profile.name || profile.given_name || verifiedEmail.split("@")[0]).trim();
            const googleId = profile.sub;

            if (!verifiedEmail) {
              throw new Error("No verified email address found on this Google account.");
            }

            // 2. Post real authenticated email and access token to COMIS backend
            const { data } = await client.post("/auth/google", {
              access_token: tokenResponse.access_token,
              email: verifiedEmail,
              name: verifiedName,
              google_id: googleId,
              mode,
              terms_accepted: effectiveTerms,
              produce_name: produceName || `${verifiedName}'s Produce`,
            });

            // 3. User is active and logged in
            login({
              token: data.access_token,
              role: data.role,
              name: data.name,
              userId: data.user_id,
              produceId: data.produce_id,
              produceName: data.produce_name || data.business_name || data.station_name,
              stationName: data.station_name || data.produce_name,
            });
            navigate("/");
          } catch (err) {
            const detail = err.response?.data?.detail || err.message || "";
            if (err.response?.status === 404) {
              setError("Account does not exist. Signup to continue");
            } else if (err.response?.status === 403) {
              setError(detail || "Your Google account is registered and currently pending System Admin approval.");
            } else {
              setError(detail || "Google authentication failed. Please try again.");
            }
          } finally {
            setGoogleLoading(false);
          }
        },
        error_callback: (err) => {
          setGoogleLoading(false);
          console.error("GIS error callback:", err);
          setError("Unable to open Google account picker. Please check browser pop-up settings.");
        },
      });

      // Triggers native Google account picker on device (brings available emails from device or use another email)
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      setGoogleLoading(false);
      console.error("Error launching Google client:", err);
      setError("Could not launch Google authentication. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-between p-0 sm:p-4 md:p-8">
      {/* Responsive Shell: Centered mobile canvas on small screens, 2-column card on tablet/desktop */}
      <div className="w-full max-w-md md:max-w-4xl min-h-screen sm:min-h-0 bg-white sm:rounded-3xl shadow-2xl overflow-hidden relative border border-slate-200 flex flex-col justify-center md:grid md:grid-cols-2">
        
        {/* Visual Brand Panel (Left on Desktop; Background Layer on Mobile) */}
        <div className="absolute inset-0 md:relative pointer-events-none md:pointer-events-auto overflow-hidden z-0 md:h-full min-h-[160px] md:min-h-[580px]">
          <img
            src="/cocoa_farmer_bg.jpg"
            alt="Cocoa Farmer holding cocoa pod"
            className="w-full h-full object-cover object-[center_bottom]"
          />
          {/* Mobile fade gradient overlay: Softened to keep center legible while cocoa pod & farmer remain visible at bottom */}
          <div
            className="absolute inset-0 pointer-events-none md:hidden"
            style={{
              background: isRegister
                ? "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.92) 30%, rgba(255,255,255,0.88) 65%, rgba(255,255,255,0.45) 85%, rgba(255,255,255,0.15) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.92) 25%, rgba(255,255,255,0.88) 60%, rgba(255,255,255,0.45) 80%, rgba(255,255,255,0.15) 100%)",
            }}
          />
          {/* Desktop gradient overlay with brand summary */}
          <div className="hidden md:flex absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 p-8 lg:p-10 flex-col justify-end text-white">
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/95 p-2 backdrop-blur-xs flex items-center justify-center shadow-lg">
                <img src="/comis-logo.png" alt="COMIS Logo" className="h-10 w-auto object-contain" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                COMIS
              </h2>
              <p className="text-sm font-bold text-amber-400">
                Weigh It. Price It. Prove It.
              </p>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                A Unified Platform for Managing Every Produce Buying
              </p>
            </div>
          </div>
        </div>

        {/* Form Panel (Right on Desktop; Foreground Centered on Mobile) */}
        <div className="relative z-10 w-full min-h-screen sm:min-h-0 px-6 py-6 sm:px-8 md:p-8 lg:p-10 flex flex-col justify-center items-center my-auto">
          
          <div className="w-full max-w-sm flex flex-col items-center my-auto">
            {/* Centered COMIS Leaf Logo */}
            <div className="flex justify-center">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center border bg-white overflow-hidden shadow-md">
                <img
                  src="/comis-logo.png"
                  alt="COMIS Logo"
                  className={`${isRegister ? "h-11 w-11 sm:h-12 sm:w-12" : "h-13 w-13 sm:h-14 sm:w-14"} object-contain`}
                />
              </div>
            </div>

            {/* Slogan */}
            <h2 className="text-[#168821] font-bold text-xs sm:text-sm text-center mt-1 tracking-tight">
              Manage your produce buying at ease
            </h2>

            {/* Action Heading */}
            <h1 className="text-[#168821] font-black text-sm sm:text-base text-center mt-0.5 tracking-wider uppercase">
              {isRegister ? "REGISTER" : "LOGIN"}
            </h1>

            {/* Feedback banners */}
            {error && (
              <div className="mt-2.5 w-full p-2.5 bg-red-50/95 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between gap-2 backdrop-blur-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
                {error.toLowerCase().includes("signup to continue") && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setError("");
                    }}
                    className="underline font-black text-[#168821] hover:text-[#0f5c18] text-xs cursor-pointer shrink-0"
                  >
                    Signup
                  </button>
                )}
                {error.includes("Click Yes to continue") && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAgreed(true);
                      setError("");
                      triggerGoogleAuth("signup", true);
                    }}
                    className="px-2.5 py-1 bg-[#168821] hover:bg-[#137a1c] text-white font-bold rounded-lg text-xs cursor-pointer shrink-0 shadow-xs"
                  >
                    Yes, Continue
                  </button>
                )}
              </div>
            )}

            {success && (
              <div className="mt-2.5 w-full p-2 bg-emerald-50/95 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 backdrop-blur-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            {/* =========================================================================
                SIGN IN VIEW
                ========================================================================= */}
            {!isRegister ? (
              <form onSubmit={handleLogin} className="w-full mt-3 flex flex-col">
                <div className="space-y-2.5">
                  {/* Email field */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-11 h-12 sm:h-11 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3.5 py-2 sm:py-2.5 text-slate-800 placeholder-slate-400 text-sm focus:outline-none bg-transparent"
                    />
                  </div>

                  {/* Password field */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-11 h-12 sm:h-11 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-3.5 py-2 sm:py-2.5 text-slate-800 placeholder-slate-400 text-sm focus:outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="pr-3.5 pl-1 text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showLoginPassword ? <Eye className="w-5 h-12" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex justify-end px-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        setForgotStep(1);
                        setForgotError("");
                        setForgotSuccess("");
                        setShowForgotModal(true);
                      }}
                      className="text-[11px] font-bold text-[#168821] hover:text-[#0f5c18] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                {/* Primary Action Button (Sign In) */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full h-12 bg-[#168821] hover:bg-[#137a1c] active:scale-[0.98] text-white font-bold py-2.8 sm:py-3 rounded-full text-sm sm:text-base shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                {/* OR Separator */}
                <div className="w-full text-center my-1.5">
                  <span className="text-xs font-semibold text-slate-600 tracking-wider">OR</span>
                </div>

                {/* Continue with Google */}
                <button
                  type="button"
                  onClick={() => triggerGoogleAuth("signin")}
                  className="w-full h-12 bg-white/80 hover:bg-white active:scale-[0.98] border border-slate-700 text-slate-800 font-semibold py-2 sm:py-2.5 rounded-full text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2 backdrop-blur-xs transition-all cursor-pointer disabled:opacity-60"
                  disabled={googleLoading || loading}
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#168821]" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>

                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Switch link */}
                <div className="mt-2.5 text-center text-xs text-slate-800 font-medium">
                  <p>
                    Do not have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegister(true);
                        setError("");
                        setSuccess("");
                      }}
                      className="text-[#168821] font-bold underline hover:text-green-800 transition cursor-pointer"
                    >
                      Signup
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              /* =========================================================================
                 SIGN UP VIEW (Produce Name & Mandatory Legal Agreements)
                 ========================================================================= */
              <form onSubmit={handleRegister} className="w-full mt-2.5 flex flex-col">
                <div className="space-y-2">
                  {/* Produce Name */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-10 h-9 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <LayoutGrid className="w-4.5 h-4.5 text-white" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Produce Name"
                      value={produceName}
                      onChange={(e) => setProduceName(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none bg-transparent font-medium"
                    />
                  </div>

                  {/* Address */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-10 h-9 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <MapPin className="w-4.5 h-4.5 text-white" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none bg-transparent font-medium"
                    />
                  </div>

                  {/* Email */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-10 h-9 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <Mail className="w-4.5 h-4.5 text-white" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none bg-transparent font-medium"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-10 h-9 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <Phone className="w-4.5 h-4.5 text-white" />
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="Phone Number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none bg-transparent font-medium"
                    />
                  </div>

                  {/* Password */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-10 h-9 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <Lock className="w-4.5 h-4.5 text-white" />
                    </div>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      placeholder="Password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none bg-transparent font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="pr-3 pl-1 text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showRegPassword ? <Eye className="w-4.5 h-4.5" /> : <EyeOff className="w-4.5 h-4.5" />}
                    </button>
                  </div>

                  {/* Confirm Password */}
                  <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition">
                    <div className="w-10 h-9 bg-[#168821] flex items-center justify-center shrink-0 border-r border-slate-700">
                      <Lock className="w-4.5 h-4.5 text-white" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-1.5 sm:py-2 text-slate-800 placeholder-slate-400 text-xs sm:text-sm focus:outline-none bg-transparent font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="pr-3 pl-1 text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showConfirmPassword ? <Eye className="w-4.5 h-4.5" /> : <EyeOff className="w-4.5 h-4.5" />}
                    </button>
                  </div>

                  {/* Mandatory Legal Agreement Checkbox */}
                  <div className="pt-1 px-1 flex items-start gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id="legalConsent"
                      checked={isAgreed}
                      onChange={(e) => setIsAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[#168821] focus:ring-[#168821] cursor-pointer shrink-0"
                    />
                    <label htmlFor="legalConsent" className="text-[11px] text-slate-700 leading-tight select-none">
                      I have read and agree to the{" "}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#168821] font-bold underline hover:text-[#0f5c18] cursor-pointer"
                      >
                        Terms of Service
                      </Link>
                      {", "}
                      <Link
                        to="/user-agreement"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#168821] font-bold underline hover:text-[#0f5c18] cursor-pointer"
                      >
                        User Agreement
                      </Link>
                      {", and "}
                      <Link
                        to="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#168821] font-bold underline hover:text-[#0f5c18] cursor-pointer"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </label>
                  </div>
                </div>

                {/* Primary Action Button (Register) */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full bg-[#168821] hover:bg-[#137a1c] active:scale-[0.98] text-white font-bold py-2.5 sm:py-3 rounded-full text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Registering..." : "Register"}
                </button>

                {/* OR Separator */}
                <div className="w-full text-center my-1.5">
                  <span className="text-xs font-semibold text-slate-600 tracking-wider">OR</span>
                </div>

                {/* Continue with Google */}
                <button
                  type="button"
                  onClick={() => triggerGoogleAuth("signup")}
                  className="w-full bg-white/80 hover:bg-white active:scale-[0.98] border border-slate-700 text-slate-800 font-semibold py-2 sm:py-2.5 rounded-full text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2 backdrop-blur-xs transition-all cursor-pointer disabled:opacity-60"
                  disabled={googleLoading || loading}
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#168821]" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>

                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
                {/* Switch link */}
                <div className="mt-2.5 text-center text-xs text-slate-800 font-medium">
                  <p>
                    Have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegister(false);
                        setError("");
                        setSuccess("");
                      }}
                      className="text-[#168821] font-bold underline hover:text-green-800 transition cursor-pointer"
                    >
                      Login
                    </button>
                  </p>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>

      {/* =========================================================================
          LANDING / LOGIN FOOTER
          ========================================================================= */}
      <footer className="w-full max-w-md md:max-w-4xl my-6 px-4 py-6 border-t border-slate-300 text-xs text-slate-600">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 font-black text-slate-900 text-sm">
              <Building2 className="w-4 h-4 text-[#168821]" />
              <span>Bukuma Inc.</span>
            </div>
            <p className="flex items-center justify-center sm:justify-start gap-1 text-slate-600 text-xs">
              <MapPin className="w-3.5 h-3.5 text-[#168821] shrink-0" />
              <span>Address: Fachima Block, The Village. KC, SL</span>
            </p>
            <p className="flex items-center justify-center sm:justify-start gap-1 text-slate-600 text-xs">
              <Mail className="w-3.5 h-3.5 text-[#168821] shrink-0" />
              <span>Email: </span>
              <a href="mailto:comisworldproduce@gmail.com" className="text-[#168821] font-bold hover:underline">
                comisworldproduce@gmail.com
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-700">
            <Link to="/about" className="hover:text-[#168821] transition">
              About COMIS
            </Link>
            <span className="text-slate-300">•</span>
            <Link to="/terms" className="hover:text-[#168821] transition">
              Terms of Service
            </Link>
            <span className="text-slate-300">•</span>
            <Link to="/user-agreement" className="hover:text-[#168821] transition">
              User Agreement
            </Link>
            <span className="text-slate-300">•</span>
            <Link to="/privacy" className="hover:text-[#168821] transition">
              Privacy Policy
            </Link>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} Bukuma Inc. All rights reserved.
        </div>
      </footer>

      {/* =========================================================================
          LEGAL AGREEMENTS MODAL (Terms, User Agreement, Privacy Policy)
          ========================================================================= */}
      <LegalModal
        isOpen={showLegalModal}
        initialTab={legalModalTab}
        onClose={() => setShowLegalModal(false)}
        onAgree={() => {
          setIsAgreed(true);
          setShowLegalModal(false);
        }}
      />

      {/* =========================================================================
          FORGOT PASSWORD MODAL (Sends 6-digit code via email from comisworldproduce@gmail.com)
          ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto border-2 border-[#168821]">
            
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-[#168821] rounded-lg">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {forgotStep === 1 ? "Reset Your Password" : "Enter Verification Code"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotError && (
              <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendForgotEmail} className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Enter the email address registered with your Produce Manager or Secretary account. We will send a secure 6-digit reset code and link.
                </p>

                <div className="flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5">
                  <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="h-6 w-px bg-slate-300 mx-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your registered email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-slate-600 font-bold hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 bg-[#168821] hover:bg-[#126e1a] text-white font-bold rounded-full shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? "Sending Code..." : "Send Reset Code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Enter the 6-digit verification code sent to <strong>{forgotEmail || "your email"}</strong>, and set your new password.
                </p>

                {/* 6-Digit Code */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123456"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    className="w-full text-center font-mono text-lg font-black tracking-widest bg-slate-50 border border-slate-300 rounded-xl py-2 focus:ring-2 focus:ring-[#168821] focus:outline-none"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    New Password (min. 8 characters)
                  </label>
                  <input
                    type={showForgotPass ? "text" : "password"}
                    required
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-[#168821] focus:outline-none"
                  />
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showForgotPass ? "text" : "password"}
                    required
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-[#168821] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="flex items-center gap-1 text-slate-500 font-bold hover:text-slate-800"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 bg-[#168821] hover:bg-[#126e1a] text-white font-bold rounded-full shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? "Resetting..." : "Save New Password"}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
