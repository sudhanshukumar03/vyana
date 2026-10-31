/** Abstract, static brand artwork; the arcs never represent health measurements. */
export function AuthBackdrop(){
  return <svg className="auth-art" viewBox="0 0 725 941" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true" focusable="false">
    <rect width="725" height="941" fill="#182633"/>
    <circle cx="535" cy="665" r="300" stroke="#d8e5ff" strokeOpacity=".09"/>
    <circle cx="535" cy="665" r="240" stroke="#d8e5ff" strokeOpacity=".1"/>
    <circle cx="535" cy="665" r="180" stroke="#d8e5ff" strokeOpacity=".12"/>
    <path d="M535 365a300 300 0 0 1 285 392" stroke="#b8caed" strokeWidth="35" strokeLinecap="round"/>
    <path d="M308 743a240 240 0 1 1 411 75" stroke="#9fc6b5" strokeWidth="35" strokeLinecap="round"/>
    <path d="M398 547a180 180 0 1 1 113 296" stroke="#c4b4df" strokeWidth="35" strokeLinecap="round"/>
    <circle cx="535" cy="665" r="20" fill="#ecf2ff"/>
    <circle cx="535" cy="665" r="45" stroke="#dce6fb" strokeOpacity=".25"/>
  </svg>;
}