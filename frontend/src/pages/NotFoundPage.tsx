import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 font-sans">
      <div className="w-14 h-14 rounded-[8px] border border-[#E6E6E6] flex items-center justify-center bg-[#F6F6F6] mb-4">
        <FileQuestion className="w-7 h-7 text-[#111111]" />
      </div>
      <h1 className="text-2xl font-bold text-[#111111] tracking-tight">404 - Page Not Found</h1>
      <p className="text-sm text-[#595959] mt-2 max-w-md">
        The statutory page or record you requested does not exist or has been relocated within the portal.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Go Back
        </Button>
        <Button variant="primary" onClick={() => navigate('/')}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;

