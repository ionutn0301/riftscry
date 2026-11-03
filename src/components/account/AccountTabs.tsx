export default function AccountTabs({ active }: { active: 'profile' | 'account' }) {
  return <nav className="account-tabs" aria-label="Your account">
    <a href="/profile" aria-current={active === 'profile' ? 'page' : undefined}>My profile</a>
    <a href="/account" aria-current={active === 'account' ? 'page' : undefined}>Account & sync</a>
  </nav>;
}
