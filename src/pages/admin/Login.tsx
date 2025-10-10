import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect directly to dashboard - no authentication required
    navigate('/admin/dashboard');
  }, [navigate]);

  return null;
};

export default AdminLogin;
