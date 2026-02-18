import { Navigate } from 'react-router-dom';

/** GroupMasterPage は UserMasterPage に統合されました */
export default function GroupMasterPage() {
  return <Navigate to="/users" replace />;
}

