import { useMemo, useState } from "react";
import { COUNTRIES, flagEmoji } from "../game/countries.js";
import "./OnboardingModal.css";

const TERMS_TEXT = `Welcome to MarCheckers.

1. Virtual Currency Only
All coins, bets, and winnings in MarCheckers are virtual in-game currency. They have no real-world monetary value, cannot be exchanged for cash, and cannot be purchased with real money. Nothing in this app constitutes gambling.

2. Eligibility
You must be at least 13 years old to create an account. By continuing, you confirm the date of birth you provide is accurate.

3. Fair Play
Cheating, exploiting bugs, or using automated tools to play on your behalf is not allowed and may result in account suspension.

4. Conduct
Be respectful in chat and voice features. Harassment, hate speech, or abusive behavior toward other players will not be tolerated.

5. Account Responsibility
You're responsible for activity on your account. Keep your login credentials secure.

6. Data
We store your gameplay stats, profile information, and the country/date of birth you provide here to personalize your experience and verify eligibility. Your date of birth is never shown publicly.

7. Changes
These terms may be updated from time to time. Continued use of the app after changes means you accept the updated terms.

By clicking Continue below, you confirm you have read and agree to these terms.`;

function calcAge(dobStr) {
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;
  const diff = Date.now() - dob.getTime();
  return diff / (365.25 * 24 * 60 * 60 * 1000);
}

export default function OnboardingModal({ onComplete }) {
  const [country, setCountry] = useState("");
  const [dob, setDob] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const age = dob ? calcAge(dob) : null;
  const dobValid = dob && age !== null && age >= 13 && age < 120;
  const canContinue = agreed && !!country && dobValid && !submitting;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);
    const res = await onComplete({ country, dateOfBirth: dob, agreedToTerms: true });
    setSubmitting(false);
    if (!res?.ok) setError(res?.error || "Something went wrong — please try again.");
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <span className="onboarding-header__icon">🛡️</span>
          <h2>Welcome to MarCheckers</h2>
          <p>Before you play, please confirm a few details.</p>
        </div>

        <div className="onboarding-field">
          <label>Country</label>
          <div className="onboarding-country-row">
            {country && <span className="onboarding-flag">{flagEmoji(country)}</span>}
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="" disabled>
                Select your country…
              </option>
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {flagEmoji(code)} {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="onboarding-field">
          <label>Date of Birth</label>
          <input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} />
          {dob && !dobValid && <span className="onboarding-field__error">You must be at least 13 years old.</span>}
        </div>

        <div className="onboarding-field">
          <label>Terms &amp; Policy</label>
          <div className="onboarding-terms-box">
            <pre>{TERMS_TEXT}</pre>
          </div>
        </div>

        <label className="onboarding-checkbox">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I have read and agree to the Terms &amp; Policy</span>
        </label>

        {error && <p className="onboarding-error">{error}</p>}

        <button className={`onboarding-continue ${canContinue ? "onboarding-continue--active" : ""}`} disabled={!canContinue} onClick={handleContinue}>
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
