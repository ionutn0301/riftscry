export default function AccountTabs() {
  return <nav className="account-section-nav" aria-label="Account sections">
    <a href="#profile"><span aria-hidden="true">01</span>My profile</a>
    <a href="#riot-id"><span aria-hidden="true">02</span>Riot ID</a>
    <a href="#practice-plan"><span aria-hidden="true">03</span>Practice plan</a>
    <a href="#account-data"><span aria-hidden="true">04</span>Data & sign-in</a>
  </nav>;
}
