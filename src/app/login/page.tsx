import { requestCode, verifyCode } from "../actions";
import { Flash } from "@/components/ui";

type SP = { step?: string; email?: string; next?: string; error?: string };

export default function Login({ searchParams }: { searchParams: SP }) {
  const next = searchParams.next || "/";
  const codeStep = searchParams.step === "code" && searchParams.email;
  return (
    <div className="panel narrow">
      <h1>Sign in</h1>
      <Flash error={searchParams.error} />
      {codeStep ? (
        <form action={verifyCode} className="form">
          <p className="full muted">
            We sent a 6-digit code to <b>{searchParams.email}</b>. It expires in 10 minutes.
          </p>
          <input type="hidden" name="email" value={searchParams.email} />
          <input type="hidden" name="next" value={next} />
          <label className="full">
            Sign-in code
            <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus />
          </label>
          <div className="full actions">
            <button className="btn primary" type="submit">Sign in</button>
            <a className="btn link" href={`/login?next=${encodeURIComponent(next)}`}>Use a different email</a>
          </div>
        </form>
      ) : (
        <form action={requestCode} className="form">
          <p className="full muted">No password needed. Enter your work email and we&apos;ll send you a sign-in code.</p>
          <input type="hidden" name="next" value={next} />
          <label className="full">
            Email
            <input type="email" name="email" autoComplete="email" required autoFocus defaultValue={searchParams.email} />
          </label>
          <div className="full actions">
            <button className="btn primary" type="submit">Email me a code</button>
          </div>
        </form>
      )}
    </div>
  );
}
