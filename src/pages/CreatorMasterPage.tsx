import { Navigate } from 'react-router-dom';

/** CreatorMasterPage は UserMasterPage に統合されました */
export default function CreatorMasterPage() {
  return <Navigate to="/users" replace />;
}

