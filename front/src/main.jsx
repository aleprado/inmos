import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login     from './components/Login';
import App       from './components/App';
import './index.css';

function Root() {
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );

  return user ? <App user={user} /> : <Login />;
}

createRoot(document.getElementById('root')).render(<Root />);
