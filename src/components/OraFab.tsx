import { useState } from 'react';
import { Plus } from 'lucide-react';
import AddOraModal from './AddOraModal';
import './OraFab.css';

function OraFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="ora-fab" type="button" onClick={() => setOpen(true)}>
        <span className="ora-fab-icon"><Plus size={16} strokeWidth={2.75} /></span>
        <span className="ora-fab-label">Add Ora</span>
      </button>

      {open && <AddOraModal onClose={() => setOpen(false)} />}
    </>
  );
}

export default OraFab;
