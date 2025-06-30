import React from 'react';
import { CheckCircle2, FolderOpen, Plus } from 'lucide-react';
import { Session } from '../../types';

interface SessionSelectorProps {
  sessions: Session[];
  selectedSessionId: string;
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => void;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onCreateSession
}) => {
  const activeSessions = sessions.filter(s => s.status !== 'completed' && s.status !== 'frozen');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-gray-100 text-gray-800';
      case 'uploading': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'reviewing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Select Session</h2>
        <button
          onClick={onCreateSession}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>New Session</span>
        </button>
      </div>

      {activeSessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                selectedSessionId === session.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{session.lcNumber}</h3>
                  <p className="text-sm text-slate-600">CIF: {session.cifNumber}</p>
                  <p className="text-xs text-slate-500 mt-1">{session.lifecycle}</p>
                </div>
                {selectedSessionId === session.id && (
                  <CheckCircle2 className="text-blue-500" size={20} />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                  {session.status}
                </span>
                <span className="text-xs text-slate-500">
                  {session.documents?.length || 0} docs
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto text-slate-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Active Sessions</h3>
          <p className="text-slate-600 mb-4">Create a new session to start uploading documents</p>
          <button
            onClick={onCreateSession}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Session
          </button>
        </div>
      )}
    </div>
  );
};

export default SessionSelector;