import { useAuth } from '../context/AuthContext';

function Home() {
  const { user } = useAuth();

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <div className="card">
        <p className="placeholder-text">
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}. Build your dashboard here.
        </p>
      </div>
    </div>
  );
}

export default Home;
