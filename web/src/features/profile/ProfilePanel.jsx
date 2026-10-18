export default function ProfilePanel({ user }) {
  return (
    <section className="panel wide-panel profile-panel">
      <h3>Profile</h3>
      <div className="profile-grid">
        <div>
          <label>Full name</label>
          <p>{user.full_name}</p>
        </div>
        <div>
          <label>Email</label>
          <p>{user.email}</p>
        </div>
        <div>
          <label>Role</label>
          <p>{user.role}</p>
        </div>
        <div>
          <label>Status</label>
          <p>{user.is_active ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    </section>
  );
}
