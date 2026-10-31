/** A native next step from evidence to an action, shared by the player journey. */
export default function JourneyHandoff({href,label,cue='Continue'}:{href:string;label:string;cue?:string}) {
  return <a className="journey-handoff" href={href} aria-label={label}><span><small>{cue}</small><strong>{label}</strong></span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></a>;
}
