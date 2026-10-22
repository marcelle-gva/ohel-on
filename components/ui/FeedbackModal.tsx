import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
}

export function FeedbackModal({ isOpen, onClose, type, title, message }: FeedbackModalProps) {
  if (!isOpen) return null;

  const configs = {
    success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
    warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  };

  const { icon: Icon, color, bg } = configs[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          {message}
        </p>
        
        <div className="flex items-center justify-end">
          <button 
            onClick={onClose}
            className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-md text-sm transition-colors w-full"
          >
            OK
          </button>
        </div>

      </div>
    </div>
  );
}