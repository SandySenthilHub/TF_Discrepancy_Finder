import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (data: { cifNumber: string; lcNumber: string; lifecycle: string }) => void;
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onCreateSession
}) => {
  const [formData, setFormData] = useState({
    cifNumber: '',
    lcNumber: '',
    lifecycle: ''
  });

  const handleSubmit = () => {
    if (!formData.cifNumber || !formData.lcNumber || !formData.lifecycle) {
      return;
    }
    onCreateSession(formData);
    setFormData({ cifNumber: '', lcNumber: '', lifecycle: '' });
  };

  const handleClose = () => {
    setFormData({ cifNumber: '', lcNumber: '', lifecycle: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-900">Create New Session</h3>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CIF Number *
            </label>
            <input
              type="text"
              value={formData.cifNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, cifNumber: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter CIF number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              LC Number *
            </label>
            <input
              type="text"
              value={formData.lcNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, lcNumber: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter LC number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lifecycle *
            </label>
            <select
              value={formData.lifecycle}
              onChange={(e) => setFormData(prev => ({ ...prev, lifecycle: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select lifecycle</option>
              <option value="Import LC">Import LC</option>
              <option value="Export LC">Export LC</option>
              <option value="Standby LC">Standby LC</option>
              <option value="Documentary Collection">Documentary Collection</option>
              <option value="Trade Finance">Trade Finance</option>
              <option value="Bank Guarantee">Bank Guarantee</option>
              <option value="Supply Chain Finance">Supply Chain Finance</option>
            </select>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.cifNumber || !formData.lcNumber || !formData.lifecycle}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSessionModal;