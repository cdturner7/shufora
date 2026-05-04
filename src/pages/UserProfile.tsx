import { useAuth } from '../context/AuthContext';

function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="page">
<div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {user.displayName && (
            <div>
              <span className="form-label" style={{ display: 'block' }}>Name</span>
              <span style={{ color: 'var(--color-text)' }}>{user.displayName}</span>
            </div>
          )}
          {user.email && (
            <div>
              <span className="form-label" style={{ display: 'block' }}>Email</span>
              <span style={{ color: 'var(--color-text)' }}>{user.email}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
