import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.jsx";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function Root() {
  if (CLERK_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY} signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
        <App />
      </ClerkProvider>
    );
  }
  // Clerk isn't configured — the app still works fully via the built-in
  // username/password + guest flow (see SETUP.md to enable Clerk).
  return <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
